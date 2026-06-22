# RabbitMQ Dead Letter — Publisher → Consumer → DLQ

Bağımsız bir RabbitMQ demosu. Publisher mesaj gönderir, consumer işler; hata
olursa retry kuyruğu ve ardından **dead letter queue (DLQ)** devreye girer.

## Akış

```
Publisher
    │
    ▼
events.exchange ──► events.queue ──► Consumer
                          │
              nack(requeue=false)
                          ▼
              events.retry.exchange
                          │
                          ▼
              events.retry.queue (TTL: 3s)
                          │ süre dolunca
                          ▼
              events.exchange (tekrar ana kuyruk)

Consumer MAX_MESSAGE_RETRIES aşınca:
    manuel publish ──► events.dlx.exchange ──► events.dlq
```

## Klasör yapısı

```
08-rabbitmq-dead-letter/
  docker-compose.yml
  nodejs/
    setup.js       — topoloji + sabitler
    publisher.js
    consumer.js
    dlq.js         — DLQ okuma
    demo.js        — uçtan uca demo
```

## Önkoşul

```bash
cd 08-rabbitmq-dead-letter
docker compose up -d
```

RabbitMQ yönetim UI: http://localhost:15673 (guest/guest)

## Çalıştırma

```bash
cd nodejs
npm install

npm run setup     # topolojiyi oluştur
npm run consume   # terminal 1
npm run publish   # terminal 2
npm run dlq       # DLQ kontrolü
npm run demo      # hepsi tek komutta
```

## Consumer karar mantığı

```js
try {
  processOrder(order);
  channel.ack(msg);
} catch (err) {
  if (deathCount(msg) >= MAX_RETRIES) {
    sendToDlq(channel, msg, err.message);
    channel.ack(msg);
  } else {
    channel.nack(msg, false, false); // → retry kuyruğu
  }
}
```

## Parametreler

| Değişken | Varsayılan | Açıklama |
|----------|------------|----------|
| `MAX_MESSAGE_RETRIES` | 2 | DLQ'ya gitmeden önceki retry sayısı |
| `RETRY_TTL_MS` | 3000 | Retry kuyruğunda bekleme (ms) |
| `RABBITMQ_URL` | amqp://guest:guest@127.0.0.1:5673 | |

```bash
MAX_MESSAGE_RETRIES=1 RETRY_TTL_MS=1000 npm run demo
```
