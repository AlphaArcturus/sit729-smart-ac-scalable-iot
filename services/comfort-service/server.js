// server.js
// Comfort decision microservice for the scalable smart AC IoT project.

const express = require("express");
const cors = require("cors");
const { decideComfortAction } = require("./fuzzyComfort");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

function validateTelemetry(req, res, next) {
  const data = req.body;

  const requiredFields = [
    "eventId",
    "buildingId",
    "roomId",
    "deviceId",
    "timestamp",
    "temperatureC",
    "humidityPct",
    "occupancy",
    "co2Ppm"
  ];

  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null) {
      return res.status(400).json({
        error: "Invalid telemetry payload",
        message: `Missing required field: ${field}`
      });
    }
  }

  const numericFields = ["temperatureC", "humidityPct", "occupancy", "co2Ppm"];

  for (const field of numericFields) {
    if (typeof data[field] !== "number" || Number.isNaN(data[field])) {
      return res.status(400).json({
        error: "Invalid telemetry payload",
        message: `${field} must be a number`
      });
    }
  }

  next();
}

app.get("/", (req, res) => {
  res.json({
    service: "smart-ac-comfort-service",
    status: "running",
    description: "Calculates comfort decisions and simulated AC commands"
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "comfort-service",
    timestamp: new Date().toISOString()
  });
});

app.post("/comfort/decision", validateTelemetry, (req, res) => {
  const decision = decideComfortAction(req.body);

  console.log(
    `[comfort-service] ${decision.roomId} -> ${decision.decision.comfortLevel}, setpoint ${decision.decision.recommendedSetpoint}C, fan ${decision.decision.fanSpeed}`
  );

  res.status(200).json(decision);
});

app.use((req, res) => {
  res.status(404).json({
    error: "Not found",
    message: `Route ${req.method} ${req.originalUrl} does not exist`
  });
});

app.listen(PORT, () => {
  console.log(`Comfort service running on port ${PORT}`);
});