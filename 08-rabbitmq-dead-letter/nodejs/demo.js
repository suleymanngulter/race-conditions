const amqp = require("amqplib");
const { URL, RETRY_TTL_MS, Q, setup } = require("./setup");
const { publish } = require("./publisher");
const { startConsumer } = require("./consumer");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function drainDlq(channel) {
  let count = 0;
  let msg;
  while ((msg = await channel.get(Q.DLQ, { noAck: false }))) {
    const body = JSON.parse(msg.content.toString());
    console.log(`  ${body.id}: ${body.deadLetterReason}`);
    channel.ack(msg);
    count += 1;
  }
  return count;
}

async function main() {
  const conn = await amqp.connect(URL);
  const ch = await conn.createChannel();
  await setup(ch);
  await ch.purgeQueue(Q.MAIN);
  await ch.purgeQueue(Q.RETRY);
  await ch.purgeQueue(Q.DLQ);
  await ch.close();
  await conn.close();

  const consumer = await startConsumer();

  console.log("\n--- Publisher ---\n");
  await publish();

  const waitMs = RETRY_TTL_MS * 3 + 4000;
  console.log(`\n--- Bekleniyor (${waitMs}ms) ---\n`);
  await sleep(waitMs);

  console.log("\n--- DLQ ---\n");
  const inspect = await amqp.connect(URL);
  const inspectCh = await inspect.createChannel();
  const dlqCount = await drainDlq(inspectCh);
  await inspectCh.close();
  await inspect.close();

  await consumer.close();
  console.log(`\nDLQ'da ${dlqCount} mesaj.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
