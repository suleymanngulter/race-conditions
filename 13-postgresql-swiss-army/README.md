# PostgreSQL Swiss Army Knife

Tek PostgreSQL ile 5 kısa demo:

| Komut | Özellik | Yerine |
|-------|---------|--------|
| `jsonb` | JSONB `@>` sorgusu | MongoDB |
| `fulltext` | `tsvector` / `ts_rank` | Elasticsearch |
| `vector` | pgvector `<=>` | Vektör DB |
| `postgis` | `ST_DWithin` | Harita motoru |
| `queue` | `NOTIFY` + `SKIP LOCKED` | İş kuyruğu |

```
13-postgresql-swiss-army/
  Dockerfile
  docker-compose.yml
  docker/init.sql
  nodejs/
    src/
      db.js
      demos.js
      demo.js
```

## Çalıştırma

```bash
cd 13-postgresql-swiss-army
docker compose up -d --build

cd nodejs && cp .env.example .env && npm install
npm run demo              # hepsi
npm run jsonb             # tek demo
```

PostgreSQL: `postgres://demo:demo@127.0.0.1:5432/swiss_army`
