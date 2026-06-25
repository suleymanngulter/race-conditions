# MongoDB Dinamik Ürün Kataloğu & Sepet API

WiredTiger doküman kilidi, esnek şema (`Map` attributes), gömülü sepet alt
dokümanları ve atomic `$inc` / `$push` güncellemeleri ile Express + Mongoose API.

## Klasör yapısı

```
12-mongodb-catalog-cart/
  docker-compose.yml
  nodejs/
    .env.example
    package.json
    src/
      server.js              — giriş noktası
      app.js                 — Express uygulaması
      seed.js                — örnek ürünler
      config/
        env.js               — PORT, MONGODB_URI
        db.js                — Mongoose bağlantısı
      models/
        Product.js             — katı alanlar + Map attributes
        Cart.js                — gömülü items[]
      controllers/
        productController.js
        cartController.js
      routes/
        index.js
        productRoutes.js
        cartRoutes.js
      middleware/
        asyncHandler.js
        errorHandler.js
```

## Mimari özet

| Katman | Rol |
|--------|-----|
| **Routes** | HTTP yolu → controller |
| **Controllers** | İş mantığı, Mongoose sorguları (async/await) |
| **Models** | Şema, indeks, ref tanımları |
| **Config** | `.env` + DB bağlantısı |
| **Middleware** | Merkezi hata yakalama |

**WiredTiger:** Sepet güncellemeleri dokümanı Node'da okuyup yazmak yerine `$inc` /
`$push` ile motor üzerinde atomik yapılır.

**Esnek şema:** `Product.attributes` → `Map` (Mixed); kategori bazlı farklı alanlar.

**Gömülü sepet:** `Cart.items[]` alt doküman; `productId` ref ile `.populate()`.

## Önkoşul

```bash
cd 12-mongodb-catalog-cart
docker compose up -d
```

MongoDB: `127.0.0.1:27017` / veritabanı: `catalog`

## Kurulum

```bash
cd nodejs
cp .env.example .env
npm install
npm run seed
npm start
```

API: `http://127.0.0.1:3012`

## Endpoint'ler

### `POST /api/products`

```bash
curl -s -X POST http://127.0.0.1:3012/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Gaming Laptop",
    "price": 48000,
    "category": "laptop",
    "attributes": { "ram": 32, "storage": 1024, "gpu": "RTX 4060" }
  }'
```

### `GET /api/products`

Kategori + dinamik özellik filtresi:

```bash
curl "http://127.0.0.1:3012/api/products?category=laptop&ram=16"
curl "http://127.0.0.1:3012/api/products?category=clothing&size=M"
```

### `POST /api/cart/add`

```bash
curl -s -X POST http://127.0.0.1:3012/api/cart/add \
  -H "Content-Type: application/json" \
  -d '{ "userId": "user-42", "productId": "<PRODUCT_ID>", "quantity": 2 }'
```

Aynı ürün tekrar eklenirse `$inc` ile miktar artar.

### `GET /api/cart/:userId`

```bash
curl http://127.0.0.1:3012/api/cart/user-42
```

`items.productId` alanı ürün detaylarıyla populate edilir.

## Ortam değişkenleri

| Değişken | Varsayılan |
|----------|------------|
| `PORT` | 3012 |
| `MONGODB_URI` | mongodb://127.0.0.1:27017/catalog |
