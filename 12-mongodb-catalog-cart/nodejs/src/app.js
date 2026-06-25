const express = require("express");
const apiRoutes = require("./routes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(express.json({ limit: "1mb" }));

app.get("/health", (req, res) => {
  res.json({ success: true, status: "ok" });
});

app.use("/api", apiRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Endpoint bulunamadı" });
});

app.use(errorHandler);

module.exports = app;
