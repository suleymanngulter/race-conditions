module.exports = {
  RABBITMQ_URL: process.env.RABBITMQ_URL || "amqp://guest:guest@127.0.0.1:5673",

  MAIN_EXCHANGE: process.env.MAIN_EXCHANGE || "events.exchange",
  RETRY_EXCHANGE: process.env.RETRY_EXCHANGE || "events.retry.exchange",
  DLX_EXCHANGE: process.env.DLX_EXCHANGE || "events.dlx.exchange",

  MAIN_QUEUE: process.env.MAIN_QUEUE || "events.queue",
  RETRY_QUEUE: process.env.RETRY_QUEUE || "events.retry.queue",
  DLQ: process.env.DLQ || "events.dlq",

  MAIN_ROUTING_KEY: process.env.MAIN_ROUTING_KEY || "events",
  RETRY_ROUTING_KEY: process.env.RETRY_ROUTING_KEY || "retry",
  DLQ_ROUTING_KEY: process.env.DLQ_ROUTING_KEY || "dead",

  RETRY_TTL_MS: Number(process.env.RETRY_TTL_MS) || 3000,
  MAX_MESSAGE_RETRIES: Number(process.env.MAX_MESSAGE_RETRIES) || 2,
  PREFETCH: Number(process.env.PREFETCH) || 5,
};
