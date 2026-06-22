const amqp = require("amqplib");
const { URL, Q, setup } = require("./setup");

async function main() {
  const conn = await amqp.connect(URL);
  const ch = await conn.createChannel();
  await setup(ch);

  let count = 0;
  let msg;
  while ((msg = await ch.get(Q.DLQ, { noAck: false }))) {
    const body = JSON.parse(msg.content.toString());
    console.log(`DLQ: ${body.id} — ${body.deadLetterReason}`);
    ch.ack(msg);
    count += 1;
  }

  console.log(count === 0 ? "DLQ boş." : `Toplam ${count} mesaj.`);
  await ch.close();
  await conn.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
