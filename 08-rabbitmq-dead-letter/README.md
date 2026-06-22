# RabbitMQ Dead Letter — Publisher → Consumer → DLQ

Bağımsız bir RabbitMQ demosu. Sadece `amqplib` kullanır; Redis, TCP/UDP veya
başka bir senaryoya bağımlılık yoktur.

Publisher mesaj gönderir, consumer işler; hata olursa retry kuyruğu ve ardından
**dead letter queue (DLQ)** devreye girer.

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

## Retry türü (bu projede tek tür var)

Bu projede yalnızca **mesaj seviyesi retry** vardır (`MAX_MESSAGE_RETRIES`).

Consumer bir mesajı işleyemezse RabbitMQ retry kuyruğuna yönlendirir; limit
aşılınca mesaj DLQ'ya gider. İstemci kütüphanesi retry'si (ör. Redis
`maxRetriesPerRequest`) bu projede **yoktur** — sadece kuyruk mesajları söz
konusudur.

## Dead letter ne zaman oluşur?

| Durum | Bu projede |
|-------|------------|
| Consumer `basic.nack` + `requeue=false` | Retry kuyruğuna gider |
| Retry kuyruğunda TTL dolar | Ana kuyruğa geri döner |
| `MAX_MESSAGE_RETRIES` aşılır | Consumer mesajı DLQ'ya publish eder |

## Klasör yapısı

```
08-rabbitmq-dead-letter/
  docker-compose.yml   — RabbitMQ (port 5673 / 15673)
  nodejs/
    lib/
      config.js        — exchange/queue isimleri, retry limiti
      topology.js      — kuyruk + DLX tanımları
      message.js       — encode/decode, x-death sayacı
    publisher.js       — ana exchange'e mesaj yayınlar
    consumer.js        — işler, retry veya DLQ'ya yönlendirir
    dlq-monitor.js     — DLQ'daki mesajları okur
    demo.js            — uçtan uca demo
```

## Önkoşul

```bash
cd 08-rabbitmq-dead-letter
docker compose up -d
```

RabbitMQ yönetim UI: http://localhost:15673 (guest/guest)

## Kurulum ve çalıştırma

```bash
cd nodejs
npm install

npm run setup     # topolojiyi oluştur
npm run consume   # terminal 1: consumer
npm run publish   # terminal 2: publisher
npm run dlq       # terminal 3: DLQ kontrolü
npm run demo      # hepsi tek komutta (ilk deneme için)
```

## Consumer karar mantığı

```js
try {
  processOrder(order);
  channel.ack(msg);
} catch (err) {
  if (deathCount(msg) >= MAX_MESSAGE_RETRIES) {
    sendToDlq(channel, msg, err.message);
    channel.ack(msg);
  } else {
    channel.nack(msg, false, false);
  }
}
```

- `deathCount`: RabbitMQ `x-death` header'ından mesajın kaç kez retry'a gittiğini okur.
- Retry kuyruğu TTL dolunca mesajı tekrar ana kuyruğa bırakır.

## Parametreler

| Değişken | Varsayılan | Açıklama |
|----------|------------|----------|
| `MAX_MESSAGE_RETRIES` | 2 | DLQ'ya gitmeden önceki mesaj retry sayısı |
| `RETRY_TTL_MS` | 3000 | Retry kuyruğunda bekleme süresi (ms) |
| `PREFETCH` | 5 | Consumer prefetch |
| `RABBITMQ_URL` | amqp://guest:guest@127.0.0.1:5673 | |

```bash
MAX_MESSAGE_RETRIES=1 RETRY_TTL_MS=1000 npm run demo
```
