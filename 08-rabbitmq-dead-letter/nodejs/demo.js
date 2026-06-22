const { publishMessages } = require("./publisher");
const { startConsumer } = require("./consumer");
const { drainDlq } = require("./dlq-monitor");
const { purgeAll, getQueueStats } = require("./lib/topology");
const { RETRY_TTL_MS } = require("./lib/config");
const amqp = require("amqplib");
const { RABBITMQ_URL } = require("./lib/config");
const { assertTopology } = require("./lib/topology");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const connection = await amqp.connect(RABBITMQ_URL);
  const setupChannel = await connection.createChannel();
  await assertTopology(setupChannel);
  await purgeAll(setupChannel);
  await setupChannel.close();
  await connection.close();

  const stats = { processed: 0, retried: 0, deadLettered: 0 };
  const consumer = await startConsumer({
    onProcessed: () => {
      stats.processed += 1;
    },
    onRetry: () => {
      stats.retried += 1;
    },
    onDeadLetter: () => {
      stats.deadLettered += 1;
    },
  });

  console.log("\n--- Publisher mesaj gönderiyor ---\n");
  await publishMessages();

  const waitMs = RETRY_TTL_MS * 3 + 4000;
  console.log(`\n--- Consumer çalışıyor (${waitMs}ms bekleniyor) ---\n`);
  await sleep(waitMs);

  const inspectConnection = await amqp.connect(RABBITMQ_URL);
  const inspectChannel = await inspectConnection.createChannel();
  const depths = await getQueueStats(inspectChannel);
  await inspectChannel.close();
  await inspectConnection.close();

  console.log("\n--- DLQ içeriği ---\n");
  const dlqMessages = await drainDlq({
    onMessage: ({ payload }) => {
      console.log(`  ${payload.id}: ${payload.deadLetterReason}`);
    },
  });

  await consumer.close();

  console.log("\n--- Özet ---");
  console.log(`  İşlenen (ACK):     ${stats.processed}`);
  console.log(`  Retry denemesi:    ${stats.retried}`);
  console.log(`  Dead letter (DLQ): ${stats.deadLettered}`);
  console.log(`  Kuyruk derinlikleri: main=${depths.main} retry=${depths.retry} dlq=${depths.dlq}`);
  console.log(`  DLQ'dan okunan:    ${dlqMessages.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
