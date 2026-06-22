const amqp = require("amqplib");
const { URL, EX, setup } = require("./setup");

const MESSAGES = [
  { id: "order-1", product: "widget-a", shouldFail: false },
  { id: "order-2", product: "widget-b", shouldFail: false },
  { id: "order-3", product: "widget-c", shouldFail: true },
  { id: "order-4", product: "widget-d", shouldFail: false },
  { id: "order-5", product: "widget-e", shouldFail: true },
];

async function publish(messages = MESSAGES) {
  const conn = await amqp.connect(URL);
  const ch = await conn.createChannel();
  await setup(ch);

  for (const order of messages) {
    ch.publish(EX.MAIN, "events", Buffer.from(JSON.stringify(order)), {
      persistent: true,
      contentType: "application/json",
    });
    console.log(`Published ${order.id} (shouldFail=${order.shouldFail})`);
  }

  await ch.close();
  await conn.close();
}

if (require.main === module) {
  publish().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { publish, MESSAGES };
