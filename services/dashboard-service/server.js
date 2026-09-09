// server.js
// Dashboard service for the scalable smart AC IoT project.
// It reads from telemetry-service and displays a simple facilities dashboard.

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3003;
const TELEMETRY_SERVICE_URL =
  process.env.TELEMETRY_SERVICE_URL || "http://localhost:3002";

app.use(cors());
app.use(express.json());

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderDashboard(stats, latest, alerts) {
  const rooms = latest.rooms || [];
  const recentAlerts = (alerts.alerts || []).slice(-10).reverse();

  const roomRows = rooms
    .map((room) => {
      const severity =
        room.decision.actionRequired === true ? "Action required" : "Normal";

      return `
        <tr>
          <td>${escapeHtml(room.roomId)}</td>
          <td>${escapeHtml(room.input.temperatureC)}°C</td>
          <td>${escapeHtml(room.input.humidityPct)}%</td>
          <td>${escapeHtml(room.input.occupancy)}</td>
          <td>${escapeHtml(room.input.co2Ppm)} ppm</td>
          <td>${escapeHtml(room.decision.comfortLevel)}</td>
          <td>${escapeHtml(room.command.targetTemperature)}°C</td>
          <td>${escapeHtml(room.command.fanSpeed)}</td>
          <td><span class="${room.decision.actionRequired ? "badge warn" : "badge ok"}">${severity}</span></td>
        </tr>
      `;
    })
    .join("");

  const alertRows = recentAlerts
    .map(
      (alert) => `
        <tr>
          <td>${escapeHtml(alert.roomId)}</td>
          <td>${escapeHtml(alert.severity)}</td>
          <td>${escapeHtml(alert.comfortLevel)}</td>
          <td>${escapeHtml(alert.message)}</td>
          <td>${escapeHtml(alert.timestamp)}</td>
        </tr>
      `
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Smart AC Facilities Dashboard</title>
  <meta http-equiv="refresh" content="5" />
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 24px;
      background: #f4f6f8;
      color: #1f2933;
    }
    h1, h2 {
      margin-bottom: 8px;
    }
    .subtitle {
      color: #52606d;
      margin-bottom: 24px;
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-bottom: 24px;
    }
    .card {
      background: white;
      padding: 16px;
      border-radius: 10px;
      border: 1px solid #d9e2ec;
    }
    .card .label {
      color: #52606d;
      font-size: 14px;
    }
    .card .value {
      font-size: 26px;
      font-weight: bold;
      margin-top: 6px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      margin-bottom: 28px;
      border: 1px solid #d9e2ec;
    }
    th, td {
      padding: 10px;
      border-bottom: 1px solid #e4e7eb;
      text-align: left;
      font-size: 14px;
    }
    th {
      background: #e0e8f9;
    }
    .badge {
      padding: 4px 8px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: bold;
    }
    .ok {
      background: #d3f9d8;
      color: #1b4332;
    }
    .warn {
      background: #fff3bf;
      color: #7c2d12;
    }
    .footer {
      color: #52606d;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <h1>Smart AC Facilities Dashboard</h1>
  <div class="subtitle">
    Live dashboard for simulated room telemetry, comfort decisions and AC control commands.
    This page refreshes every 5 seconds.
  </div>

  <div class="cards">
    <div class="card">
      <div class="label">Rooms tracked</div>
      <div class="value">${escapeHtml(stats.roomsTracked)}</div>
    </div>
    <div class="card">
      <div class="label">Average temperature</div>
      <div class="value">${escapeHtml(stats.averageTemperatureC)}°C</div>
    </div>
    <div class="card">
      <div class="label">Average humidity</div>
      <div class="value">${escapeHtml(stats.averageHumidityPct)}%</div>
    </div>
    <div class="card">
      <div class="label">Total occupancy</div>
      <div class="value">${escapeHtml(stats.totalOccupancy)}</div>
    </div>
    <div class="card">
      <div class="label">Average CO2</div>
      <div class="value">${escapeHtml(stats.averageCo2Ppm)} ppm</div>
    </div>
    <div class="card">
      <div class="label">Alerts stored</div>
      <div class="value">${escapeHtml(stats.alertCount)}</div>
    </div>
  </div>

  <h2>Latest Room State</h2>
  <table>
    <thead>
      <tr>
        <th>Room</th>
        <th>Temp</th>
        <th>Humidity</th>
        <th>Occupancy</th>
        <th>CO2</th>
        <th>Comfort</th>
        <th>Setpoint</th>
        <th>Fan</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${roomRows || "<tr><td colspan='9'>No room data available yet.</td></tr>"}
    </tbody>
  </table>

  <h2>Recent Alerts</h2>
  <table>
    <thead>
      <tr>
        <th>Room</th>
        <th>Severity</th>
        <th>Comfort Level</th>
        <th>Message</th>
        <th>Timestamp</th>
      </tr>
    </thead>
    <tbody>
      ${alertRows || "<tr><td colspan='5'>No alerts available yet.</td></tr>"}
    </tbody>
  </table>

  <div class="footer">
    Dashboard service running on port ${PORT}. Telemetry source: ${escapeHtml(TELEMETRY_SERVICE_URL)}.
  </div>
</body>
</html>
`;
}

app.get("/", async (req, res) => {
  try {
    const [stats, latest, alerts] = await Promise.all([
      fetchJson(`${TELEMETRY_SERVICE_URL}/telemetry/stats`),
      fetchJson(`${TELEMETRY_SERVICE_URL}/telemetry/latest`),
      fetchJson(`${TELEMETRY_SERVICE_URL}/alerts`)
    ]);

    res.send(renderDashboard(stats, latest, alerts));
  } catch (error) {
    res.status(500).send(`
      <h1>Smart AC Dashboard Error</h1>
      <p>Could not load telemetry data.</p>
      <p>${escapeHtml(error.message)}</p>
      <p>Make sure telemetry-service is running on port 3002.</p>
    `);
  }
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "dashboard-service",
    telemetryServiceUrl: TELEMETRY_SERVICE_URL,
    timestamp: new Date().toISOString()
  });
});

app.get("/api/current-state", async (req, res) => {
  try {
    const latest = await fetchJson(`${TELEMETRY_SERVICE_URL}/telemetry/latest`);
    res.json(latest);
  } catch (error) {
    res.status(500).json({
      error: "Failed to load current state",
      message: error.message
    });
  }
});

app.get("/api/stats", async (req, res) => {
  try {
    const stats = await fetchJson(`${TELEMETRY_SERVICE_URL}/telemetry/stats`);
    res.json(stats);
  } catch (error) {
    res.status(500).json({
      error: "Failed to load stats",
      message: error.message
    });
  }
});

app.get("/api/alerts", async (req, res) => {
  try {
    const alerts = await fetchJson(`${TELEMETRY_SERVICE_URL}/alerts`);
    res.json(alerts);
  } catch (error) {
    res.status(500).json({
      error: "Failed to load alerts",
      message: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Dashboard service running on port ${PORT}`);
  console.log(`Reading telemetry from ${TELEMETRY_SERVICE_URL}`);
});