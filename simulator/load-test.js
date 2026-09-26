// load-test.js
// Local throughput test for the Smart AC IoT pipeline.
// Publishes simulated room telemetry through MQTT and checks telemetry-service response time.

const mqtt = require("mqtt");

const DEFAULT_ROOMS = 25;
const DEFAULT_INTERVAL_MS = 1000;
const DEFAULT_DURATION_SECONDS = 60;
const BUILDING_ID = "B01";

const MQTT_BROKER_URL = "mqtt://127.0.0.1:1883";
const TELEMETRY_STATS_URL = "http://localhost:3002/telemetry/stats";

function getNumberArg(name, defaultValue) {
  const index = process.argv.indexOf(name);
  if (index === -1 || index + 1 >= process.argv.length) return defaultValue;

  const value = Number(process.argv[index + 1]);
  return Number.isNaN(value) || value <= 0 ? defaultValue : value;
}

function randomFloat(min, max, decimals = 1) {
  return Number((Math.random() * (max - min) + min).toFixed(decimals));
}

function randomInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRoomId(roomNumber) {
  return `R${String(roomNumber).padStart(3, "0")}`;
}

function createTelemetry(roomNumber, sequence) {
  const roomId = getRoomId(roomNumber);

  return {
    eventId: `load-${roomId}-${Date.now()}-${sequence}`,
    buildingId: BUILDING_ID,
    roomId,
    deviceId: `load-sim-${roomId}`,
    timestamp: new Date().toISOString(),
    temperatureC: randomFloat(20, 35),
    humidityPct: randomInteger(35, 85),
    occupancy: randomInteger(0, 30),
    co2Ppm: randomInteger(450, 2200),
    sequence,
    scenario: "load_test"
  };
}

function topicFor(telemetry) {
  return `smartac/${telemetry.buildingId}/${telemetry.roomId}/telemetry`;
}

async function checkTelemetryService() {
  const start = Date.now();

  try {
    const response = await fetch(TELEMETRY_STATS_URL);
    const durationMs = Date.now() - start;

    if (!response.ok) {
      console.log(`[stats-check] failed HTTP ${response.status} in ${durationMs} ms`);
      return;
    }

    const stats = await response.json();

    console.log(
      `[stats-check] ${durationMs} ms | rooms=${stats.roomsTracked} | records=${stats.recordsStored} | alerts=${stats.alertCount}`
    );
  } catch (error) {
    const durationMs = Date.now() - start;
    console.log(`[stats-check] error after ${durationMs} ms: ${error.message}`);
  }
}

function startLoadTest() {
  const rooms = getNumberArg("--rooms", DEFAULT_ROOMS);
  const intervalMs = getNumberArg("--interval", DEFAULT_INTERVAL_MS);
  const durationSeconds = getNumberArg("--duration", DEFAULT_DURATION_SECONDS);

  const expectedMessagesPerSecond = Number(((rooms * 1000) / intervalMs).toFixed(2));

  let sequence = 0;
  let sentMessages = 0;
  let publishErrors = 0;

  console.log("Smart AC MQTT Load Test");
  console.log(`Broker: ${MQTT_BROKER_URL}`);
  console.log(`Rooms: ${rooms}`);
  console.log(`Interval: ${intervalMs} ms`);
  console.log(`Duration: ${durationSeconds} seconds`);
  console.log(`Expected throughput: ~${expectedMessagesPerSecond} messages/second`);
  console.log("Press Ctrl + C to stop early.\n");

  const client = mqtt.connect(MQTT_BROKER_URL);

  client.on("connect", () => {
    console.log("Connected to MQTT broker");

    const publishTimer = setInterval(() => {
      sequence += 1;

      for (let roomNumber = 1; roomNumber <= rooms; roomNumber++) {
        const telemetry = createTelemetry(roomNumber, sequence);

        client.publish(topicFor(telemetry), JSON.stringify(telemetry), { qos: 0 }, (error) => {
          if (error) {
            publishErrors += 1;
          }
        });

        sentMessages += 1;
      }

      console.log(
        `[batch ${sequence}] published ${rooms} messages | total=${sentMessages} | errors=${publishErrors}`
      );
    }, intervalMs);

    const statsTimer = setInterval(checkTelemetryService, 5000);

    setTimeout(() => {
      clearInterval(publishTimer);
      clearInterval(statsTimer);

      const actualRate = Number((sentMessages / durationSeconds).toFixed(2));

      console.log("\nLoad test finished");
      console.log(`Total messages published: ${sentMessages}`);
      console.log(`Publish errors: ${publishErrors}`);
      console.log(`Approx. actual publish rate: ${actualRate} messages/second`);

      client.end();
      process.exit(0);
    }, durationSeconds * 1000);
  });

  client.on("error", (error) => {
    console.error("MQTT error:", error.message);
  });
}

startLoadTest();