const amqp = require("amqplib");
const { URL, EX, Q, MAX_RETRIES, setup, deathCount } = require("./setup");

function processOrder(order) {
  if (order.shouldFail) {
    throw new Error(`Simüle edilmiş işlem hatası: ${order.id}`);
  }
}

function sendToDlq(channel, msg, reason) {
  const order = JSON.parse(msg.content.toString());
  channel.publish(
    EX.DLX,
    "dead",
    Buffer.from(JSON.stringify({ ...order, deadLetterReason: reason })),
    { persistent: true, contentType: "application/json" }
  );
}

async function startConsumer() {
  const conn = await amqp.connect(URL);
  const ch = await conn.createChannel();
  await setup(ch);
  await ch.prefetch(5);

  console.log(`Consumer dinliyor: ${Q.MAIN} (max retry: ${MAX_RETRIES})`);

  await ch.consume(Q.MAIN, (msg) => {
    if (!msg) return;

    const order = JSON.parse(msg.content.toString());
    const retries = deathCount(msg);

    try {
      processOrder(order);
      ch.ack(msg);
      console.log(`ACK   ${order.id}`);
    } catch (err) {
      if (retries >= MAX_RETRIES) {
        sendToDlq(ch, msg, err.message);
        ch.ack(msg);
        console.log(`DLQ   ${order.id} (retry=${retries})`);
        return;
      }
      ch.nack(msg, false, false);
      console.log(`RETRY ${order.id} (${retries + 1}/${MAX_RETRIES})`);
    }
  });

  return {
    async close() {
      await ch.close();
      await conn.close();
    },
  };
}

if (require.main === module) {
  startConsumer().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { startConsumer };
