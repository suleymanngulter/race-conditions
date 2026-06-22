const amqp = require("amqplib");
const {
  RABBITMQ_URL,
  MAIN_EXCHANGE,
  RETRY_EXCHANGE,
  DLX_EXCHANGE,
  MAIN_QUEUE,
  RETRY_QUEUE,
  DLQ,
  MAIN_ROUTING_KEY,
  RETRY_ROUTING_KEY,
  DLQ_ROUTING_KEY,
  RETRY_TTL_MS,
} = require("./config");

/**
 * Kuyruk topolojisi:
 *
 *   Publisher ──► events.exchange ──► events.queue ──► Consumer
 *                                         │
 *                           nack(requeue=false) / reject / TTL
 *                                         ▼
 *                              events.retry.exchange
 *                                         │
 *                                         ▼
 *                              events.retry.queue (TTL)
 *                                         │ süre dolunca
 *                                         ▼
 *                              events.exchange (tekrar ana kuyruk)
 *
 *   Consumer, MAX_MESSAGE_RETRIES aşılınca mesajı events.dlx.exchange üzerinden
 *   events.dlq kuyruğuna yönlendirir (manuel publish + ack).
 */
async function assertTopology(channel) {
  await channel.assertExchange(MAIN_EXCHANGE, "direct", { durable: true });
  await channel.assertExchange(RETRY_EXCHANGE, "direct", { durable: true });
  await channel.assertExchange(DLX_EXCHANGE, "direct", { durable: true });

  await channel.assertQueue(MAIN_QUEUE, {
    durable: true,
    arguments: {
      "x-dead-letter-exchange": RETRY_EXCHANGE,
      "x-dead-letter-routing-key": RETRY_ROUTING_KEY,
    },
  });
  await channel.bindQueue(MAIN_QUEUE, MAIN_EXCHANGE, MAIN_ROUTING_KEY);

  await channel.assertQueue(RETRY_QUEUE, {
    durable: true,
    arguments: {
      "x-message-ttl": RETRY_TTL_MS,
      "x-dead-letter-exchange": MAIN_EXCHANGE,
      "x-dead-letter-routing-key": MAIN_ROUTING_KEY,
    },
  });
  await channel.bindQueue(RETRY_QUEUE, RETRY_EXCHANGE, RETRY_ROUTING_KEY);

  await channel.assertQueue(DLQ, { durable: true });
  await channel.bindQueue(DLQ, DLX_EXCHANGE, DLQ_ROUTING_KEY);
}

async function purgeAll(channel) {
  await channel.purgeQueue(MAIN_QUEUE);
  await channel.purgeQueue(RETRY_QUEUE);
  await channel.purgeQueue(DLQ);
}

async function getQueueStats(channel) {
  const [main, retry, dlq] = await Promise.all([
    channel.checkQueue(MAIN_QUEUE),
    channel.checkQueue(RETRY_QUEUE),
    channel.checkQueue(DLQ),
  ]);
  return {
    main: main.messageCount,
    retry: retry.messageCount,
    dlq: dlq.messageCount,
  };
}

async function main() {
  const connection = await amqp.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();
  await assertTopology(channel);
  console.log("Topology hazır:");
  console.log(`  ${MAIN_EXCHANGE} → ${MAIN_QUEUE} (DLX: ${RETRY_EXCHANGE})`);
  console.log(`  ${RETRY_EXCHANGE} → ${RETRY_QUEUE} (TTL ${RETRY_TTL_MS}ms → ${MAIN_EXCHANGE})`);
  console.log(`  ${DLX_EXCHANGE} → ${DLQ}`);
  await channel.close();
  await connection.close();
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { assertTopology, purgeAll, getQueueStats };
