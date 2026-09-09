// server.js
// Telemetry storage microservice for the scalable smart AC IoT project.
// Local prototype uses in-memory storage. Later this can be replaced with DynamoDB.

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// In-memory storage for local prototype
const telemetryHistory = [];
const latestRoomState = new Map();
const alertHistory = [];

const MAX_HISTORY_RECORDS = 5000;

function buildRoomKey(buildingId, roomId) {
  return `${buildingId}#${roomId}`;
}

function isNumber(value) {
  return typeof value === "number" && !Number.isNaN(value);
}

function validateTelemetryRecord(req, res, next) {
  const data = req.body;

  const requiredFields = [
    "eventId",
    "buildingId",
    "roomId",
    "deviceId",
    "timestamp",
    "input",
    "decision",
    "command"
  ];

  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null) {
      return res.status(400).json({
        error: "Invalid telemetry decision record",
        message: `Missing required field: ${field}`
      });
    }
  }

  const inputFields = ["temperatureC", "humidityPct", "occupancy", "co2Ppm"];

  for (const field of inputFields) {
    if (!isNumber(data.input[field])) {
      return res.status(400).json({
        error: "Invalid telemetry input",
        message: `input.${field} must be a number`
      });
    }
  }

  if (!data.decision.comfortLevel || !data.decision.fanSpeed || !data.decision.mode) {
    return res.status(400).json({
      error: "Invalid decision object",
      message: "decision must include comfortLevel, fanSpeed and mode"
    });
  }

  next();
}

function createAlertIfNeeded(record) {
  const decision = record.decision;
  const input = record.input;

  const shouldCreateAlert =
    decision.actionRequired === true ||
    input.temperatureC >= 34 ||
    input.co2Ppm >= 1500 ||
    input.humidityPct >= 75 ||
    input.occupancy >= 20;

  if (!shouldCreateAlert) {
    return null;
  }

  let severity = "warning";

  if (input.temperatureC >= 34 || input.co2Ppm >= 2000) {
    severity = "critical";
  }

  const alert = {
    alertId: `alert-${record.roomId}-${Date.now()}`,
    eventId: record.eventId,
    buildingId: record.buildingId,
    roomId: record.roomId,
    deviceId: record.deviceId,
    timestamp: new Date().toISOString(),
    severity,
    comfortLevel: decision.comfortLevel,
    message: `Comfort action required for ${record.roomId}: ${decision.comfortLevel}`,
    resolved: false
  };

  alertHistory.push(alert);
  return alert;
}

app.get("/", (req, res) => {
  res.json({
    service: "smart-ac-telemetry-service",
    status: "running",
    description: "Stores telemetry decisions, current room state and alerts"
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "telemetry-service",
    timestamp: new Date().toISOString(),
    recordsStored: telemetryHistory.length,
    roomsTracked: latestRoomState.size,
    alertsStored: alertHistory.length
  });
});

app.post("/telemetry", validateTelemetryRecord, (req, res) => {
  const record = {
    ...req.body,
    storedAt: new Date().toISOString()
  };

  telemetryHistory.push(record);

  if (telemetryHistory.length > MAX_HISTORY_RECORDS) {
    telemetryHistory.shift();
  }

  const roomKey = buildRoomKey(record.buildingId, record.roomId);
  latestRoomState.set(roomKey, record);

  const alert = createAlertIfNeeded(record);

  console.log(
    `[telemetry-service] Stored ${record.roomId} | ${record.decision.comfortLevel} | setpoint ${record.command.targetTemperature}C`
  );

  res.status(201).json({
    message: "Telemetry decision stored",
    roomKey,
    totalRecords: telemetryHistory.length,
    alertCreated: Boolean(alert),
    alert
  });
});

app.get("/telemetry/latest", (req, res) => {
  const latest = Array.from(latestRoomState.entries()).map(([roomKey, record]) => ({
    roomKey,
    buildingId: record.buildingId,
    roomId: record.roomId,
    deviceId: record.deviceId,
    timestamp: record.timestamp,
    storedAt: record.storedAt,
    input: record.input,
    fuzzyScores: record.fuzzyScores,
    decision: record.decision,
    command: record.command
  }));

  res.json({
    count: latest.length,
    rooms: latest
  });
});

app.get("/telemetry/room/:roomId", (req, res) => {
  const roomId = req.params.roomId;

  const records = telemetryHistory.filter((record) => record.roomId === roomId);

  res.json({
    roomId,
    count: records.length,
    records
  });
});

app.get("/alerts", (req, res) => {
  res.json({
    count: alertHistory.length,
    alerts: alertHistory
  });
});

app.get("/telemetry/stats", (req, res) => {
  const latest = Array.from(latestRoomState.values());

  if (latest.length === 0) {
    return res.json({
      roomsTracked: 0,
      averageTemperatureC: null,
      averageHumidityPct: null,
      totalOccupancy: 0,
      averageCo2Ppm: null,
      alertCount: alertHistory.length
    });
  }

  const totals = latest.reduce(
    (acc, record) => {
      acc.temperatureC += record.input.temperatureC;
      acc.humidityPct += record.input.humidityPct;
      acc.occupancy += record.input.occupancy;
      acc.co2Ppm += record.input.co2Ppm;
      return acc;
    },
    {
      temperatureC: 0,
      humidityPct: 0,
      occupancy: 0,
      co2Ppm: 0
    }
  );

  res.json({
    roomsTracked: latest.length,
    averageTemperatureC: Number((totals.temperatureC / latest.length).toFixed(1)),
    averageHumidityPct: Number((totals.humidityPct / latest.length).toFixed(1)),
    totalOccupancy: totals.occupancy,
    averageCo2Ppm: Number((totals.co2Ppm / latest.length).toFixed(0)),
    alertCount: alertHistory.length,
    recordsStored: telemetryHistory.length
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: "Not found",
    message: `Route ${req.method} ${req.originalUrl} does not exist`
  });
});

app.listen(PORT, () => {
  console.log(`Telemetry service running on port ${PORT}`);
});