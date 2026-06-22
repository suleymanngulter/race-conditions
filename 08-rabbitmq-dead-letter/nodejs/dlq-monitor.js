const amqp = require("amqplib");
const { RABBITMQ_URL, DLQ } = require("./lib/config");
const { assertTopology } = require("./lib/topology");
const { decodeMessage } = require("./lib/message");

async function drainDlq({ limit = 100, onMessage } = {}) {
  const connection = await amqp.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();
  await assertTopology(channel);

  const messages = [];
  for (let i = 0; i < limit; i++) {
    const msg = await channel.get(DLQ, { noAck: false });
    if (!msg) break;

    const payload = decodeMessage(msg.content);
    const entry = {
      payload,
      headers: msg.properties.headers || {},
      routingKey: msg.fields.routingKey,
    };
    messages.push(entry);
    onMessage?.(entry);
    channel.ack(msg);
  }

  await channel.close();
  await connection.close();
  return messages;
}

async function main() {
  const messages = await drainDlq({
    onMessage: ({ payload, headers }) => {
      console.log(
        `DLQ mesajı: ${payload.id} | deathCount=${headers["x-death-count"]} | reason=${payload.deadLetterReason}`
      );
    },
  });

  if (messages.length === 0) {
    console.log("DLQ boş.");
  } else {
    console.log(`Toplam ${messages.length} dead letter mesajı okundu.`);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { drainDlq };
