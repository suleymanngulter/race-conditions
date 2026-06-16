// Tüm senaryoların önce "broken" sonra "fixed" sürümünü sırayla çalıştırır.
// Çalıştır: node run-all.js

const { execFileSync } = require("child_process");
const path = require("path");

const scenarios = [
  ["01-read-modify-write", "Read-Modify-Write (lost update)"],
  ["02-stale-response", "Stale Response / autocomplete"],
  ["03-concurrent-init", "Çift Başlatma / cache stampede"],
  ["04-check-then-act", "Check-Then-Act / TOCTOU"],
  ["05-promise-ordering", "Yanlış Sıralama"],
  ["06-async-queue", "Sıralı işleme / async queue"],
  ["07-shared-memory", "Shared Memory / data race (gerçek paralellik)"],
];

function run(file) {
  try {
    const out = execFileSync("node", [file], { cwd: __dirname }).toString();
    process.stdout.write(out);
  } catch (e) {
    process.stdout.write((e.stdout || "").toString());
    process.stderr.write((e.stderr || "").toString());
  }
}

for (const [dir, title] of scenarios) {
  console.log("\n========================================================");
  console.log("SENARYO:", title);
  console.log("========================================================");
  console.log("\n--- BOZUK (broken.js) ---");
  run(path.join(dir, "broken.js"));
  console.log("\n--- DÜZELTİLMİŞ (fixed.js) ---");
  run(path.join(dir, "fixed.js"));
}

console.log("\nNot: 'broken' senaryolar zamanlamaya bağlıdır; bazen tek çalıştırmada");
console.log("yanlış sonuç görünmeyebilir. Birkaç kez çalıştırın.");
