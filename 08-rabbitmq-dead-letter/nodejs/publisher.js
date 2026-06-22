const amqp = require("amqplib");
const { RABBITMQ_URL, MAIN_EXCHANGE, MAIN_ROUTING_KEY } = require("./lib/config");
const { assertTopology } = require("./lib/topology");
const { encodeMessage } = require("./lib/message");

/**
 * Örnek mesajlar:
 * - shouldFail: false → consumer ack eder
 * - shouldFail: true  → consumer işleyemez, retry → DLQ akışına girer
 */
const DEFAULT_MESSAGES = [
  { id: "order-1", product: "widget-a", amount: 120, shouldFail: false },
  { id: "order-2", product: "widget-b", amount: 45, shouldFail: false },
  { id: "order-3", product: "widget-c", amount: 999, shouldFail: true },
  { id: "order-4", product: "widget-d", amount: 10, shouldFail: false },
  { id: "order-5", product: "widget-e", amount: 250, shouldFail: true },
];

async function publishMessages(messages = DEFAULT_MESSAGES) {
  const connection = await amqp.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();
  await assertTopology(channel);

  for (const payload of messages) {
    const body = encodeMessage({
      ...payload,
      publishedAt: Date.now(),
    });
    channel.publish(MAIN_EXCHANGE, MAIN_ROUTING_KEY, body, {
      persistent: true,
      contentType: "application/json",
      messageId: payload.id,
    });
    console.log(`Published ${payload.id} (shouldFail=${payload.shouldFail})`);
  }

  await channel.close();
  await connection.close();
}

if (require.main === module) {
  publishMessages().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { publishMessages, DEFAULT_MESSAGES };
