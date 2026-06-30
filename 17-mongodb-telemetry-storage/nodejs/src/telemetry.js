const { BSON } = require("mongodb");

const REGIONS = ["eu-west", "us-east", "ap-south"];
const MODELS = ["DHT22", "BME280", "SHT31"];

/**
 * Gerçekçi telemetri dokümanı.
 * meta alanı Time Series metaField olarak kullanılır — sensör kimliği bucket başına bir kez saklanır.
 */
function buildTelemetry(sensorIndex, seq, baseTimeMs) {
  const sensorId = `device-${String(sensorIndex).padStart(4, "0")}`;
  let temp = 18 + (sensorIndex % 10) + Math.sin(seq / 120) * 2;
  temp += (Math.random() - 0.5) * 0.4;

  return {
    timestamp: new Date(baseTimeMs + seq * 1000),
    meta: {
      sensorId,
      region: REGIONS[sensorIndex % REGIONS.length],
      model: MODELS[sensorIndex % MODELS.length],
      firmware: `v${1 + (sensorIndex % 3)}.${sensorIndex % 10}`,
    },
    temperature: Math.round(temp * 100) / 100,
    humidity: Math.round((45 + Math.random() * 15) * 100) / 100,
    pressure: Math.round((1010 + Math.random() * 15) * 10) / 10,
    voltage: Math.round((3.2 + Math.random() * 0.5) * 100) / 100,
    rssi: -40 - Math.floor(Math.random() * 35),
  };
}

/** Örnek dokümanların ham BSON boyutu — sıkıştırmasız teorik alt sınır tahmini. */
function estimateLogicalBytes(samples) {
  return samples.reduce((sum, doc) => sum + BSON.calculateObjectSize(doc), 0);
}

module.exports = { buildTelemetry, estimateLogicalBytes };
