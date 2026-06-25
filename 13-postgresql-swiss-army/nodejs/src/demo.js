const { close, url } = require("./db");
const demos = require("./demos");

const all = ["jsonb", "fulltext", "vector", "postgis", "queue"];
const pick = process.argv[2];
const run = pick ? [pick] : all;

async function main() {
  console.log(`DB: ${url}\n`);
  for (const name of run) {
    if (!demos[name]) throw new Error(`Bilinmeyen demo: ${name}`);
    await demos[name]();
    console.log("");
  }
}

main()
  .then(() => close())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
