const amqp = require("amqplib");
const {
  RABBITMQ_URL,
  MAIN_QUEUE,
  DLX_EXCHANGE,
  DLQ_ROUTING_KEY,
  MAX_MESSAGE_RETRIES,
  PREFETCH,
} = require("./lib/config");
const { assertTopology } = require("./lib/topology");
const { decodeMessage, deathCount } = require("./lib/message");

function processOrder(order) {
  if (order.shouldFail) {
    throw new Error(`Simüle edilmiş işlem hatası: ${order.id}`);
  }
  return { status: "processed", orderId: order.id };
}

async function sendToDlq(channel, msg, reason) {
  const order = decodeMessage(msg.content);
  const body = Buffer.from(
    JSON.stringify({
      ...order,
      deadLetteredAt: Date.now(),
      deadLetterReason: reason,
      deathCount: deathCount(msg),
    })
  );

  channel.publish(DLX_EXCHANGE, DLQ_ROUTING_KEY, body, {
    persistent: true,
    contentType: "application/json",
    headers: {
      "x-original-routing-key": msg.fields.routingKey,
      "x-death-count": deathCount(msg),
      "x-dead-letter-reason": reason,
    },
  });
}

async function startConsumer({ onProcessed, onDeadLetter, onRetry } = {}) {
  const connection = await amqp.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();
  await assertTopology(channel);
  await channel.prefetch(PREFETCH);

  console.log(`Consumer dinliyor: ${MAIN_QUEUE} (max message retry: ${MAX_MESSAGE_RETRIES})`);

  await channel.consume(MAIN_QUEUE, async (msg) => {
    if (!msg) return;

    const order = decodeMessage(msg.content);
    const retries = deathCount(msg);

    try {
      const result = processOrder(order);
      channel.ack(msg);
      console.log(`ACK  ${order.id} → ${result.status}`);
      onProcessed?.(order);
    } catch (err) {
      if (retries >= MAX_MESSAGE_RETRIES) {
        await sendToDlq(channel, msg, err.message);
        channel.ack(msg);
        console.log(`DLQ  ${order.id} (retry=${retries}, sebep: ${err.message})`);
        onDeadLetter?.(order, retries);
        return;
      }

      // nack(requeue=false) → x-dead-letter-exchange (retry kuyruğu)
      channel.nack(msg, false, false);
      console.log(`RETRY ${order.id} (retry=${retries + 1}/${MAX_MESSAGE_RETRIES})`);
      onRetry?.(order, retries + 1);
    }
  });

  return {
    connection,
    channel,
    async close() {
      await channel.close();
      await connection.close();
    },
  };
}

if (require.main === module) {
  startConsumer().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { startConsumer, processOrder, sendToDlq };
