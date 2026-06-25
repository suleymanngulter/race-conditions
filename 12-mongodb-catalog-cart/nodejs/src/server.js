const app = require("./app");
const { connectDB } = require("./config/db");
const { port } = require("./config/env");

async function start() {
  await connectDB();
  const server = app.listen(port, () => {
    console.log(`API dinleniyor: http://127.0.0.1:${port}`);
  });
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `Port ${port} kullanımda. Eski süreci kapat: fuser -k ${port}/tcp`,
      );
    }
    throw err;
  });
}

start().catch((err) => {
  console.error("Sunucu başlatılamadı:", err);
  process.exit(1);
});
