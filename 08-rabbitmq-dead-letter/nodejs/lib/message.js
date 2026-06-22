function encodeMessage(payload) {
  return Buffer.from(JSON.stringify(payload));
}

function decodeMessage(buffer) {
  return JSON.parse(buffer.toString("utf8"));
}

function deathCount(msg) {
  const deaths = msg.properties.headers?.["x-death"];
  if (!Array.isArray(deaths)) return 0;
  return deaths.reduce((sum, entry) => sum + (entry.count || 0), 0);
}

module.exports = { encodeMessage, decodeMessage, deathCount };
