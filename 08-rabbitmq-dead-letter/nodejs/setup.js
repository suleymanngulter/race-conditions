const amqp = require("amqplib");

const URL = process.env.RABBITMQ_URL || "amqp://guest:guest@127.0.0.1:5673";
const RETRY_TTL_MS = Number(process.env.RETRY_TTL_MS) || 3000;
const MAX_RETRIES = Number(process.env.MAX_MESSAGE_RETRIES) || 2;

const EX = {
  MAIN: "events.exchange",
  RETRY: "events.retry.exchange",
  DLX: "events.dlx.exchange",
};

const Q = {
  MAIN: "events.queue",
  RETRY: "events.retry.queue",
  DLQ: "events.dlq",
};

async function setup(channel) {
  await channel.assertExchange(EX.MAIN, "direct", { durable: true });
  await channel.assertExchange(EX.RETRY, "direct", { durable: true });
  await channel.assertExchange(EX.DLX, "direct", { durable: true });

  await channel.assertQueue(Q.MAIN, {
    durable: true,
    arguments: {
      "x-dead-letter-exchange": EX.RETRY,
      "x-dead-letter-routing-key": "retry",
    },
  });
  await channel.bindQueue(Q.MAIN, EX.MAIN, "events");

  await channel.assertQueue(Q.RETRY, {
    durable: true,
    arguments: {
      "x-message-ttl": RETRY_TTL_MS,
      "x-dead-letter-exchange": EX.MAIN,
      "x-dead-letter-routing-key": "events",
    },
  });
  await channel.bindQueue(Q.RETRY, EX.RETRY, "retry");

  await channel.assertQueue(Q.DLQ, { durable: true });
  await channel.bindQueue(Q.DLQ, EX.DLX, "dead");
}

function deathCount(msg) {
  const deaths = msg.properties.headers?.["x-death"];
  if (!Array.isArray(deaths)) return 0;
  return deaths.reduce((n, d) => n + (d.count || 0), 0);
}

async function main() {
  const conn = await amqp.connect(URL);
  const ch = await conn.createChannel();
  await setup(ch);
  console.log("Topoloji hazır.");
  await ch.close();
  await conn.close();
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { URL, RETRY_TTL_MS, MAX_RETRIES, EX, Q, setup, deathCount };
