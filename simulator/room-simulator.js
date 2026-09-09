// room-simulator.js
// Simulates IoT room telemetry for the scalable smart air-conditioning project.
// It can print telemetry locally or publish telemetry through MQTT.

const mqtt = require("mqtt");

const DEFAULT_ROOMS = 10;
const DEFAULT_INTERVAL_MS = 5000;
const BUILDING_ID = "B01";

const MQTT_BROKER_URL = "mqtt://127.0.0.1:1883";
const MQTT_TOPIC_PREFIX = "smartac";

function hasFlag(flagName) {
  return process.argv.includes(flagName);
}

function getArgumentValue(argumentName, defaultValue) {
  const index = process.argv.indexOf(argumentName);

  if (index === -1 || index + 1 >= process.argv.length) {
    return defaultValue;
  }

  const value = Number(process.argv[index + 1]);

  if (Number.isNaN(value) || value <= 0) {
    return defaultValue;
  }

  return value;
}

function randomFloat(min, max, decimals = 1) {
  const value = Math.random() * (max - min) + min;
  return Number(value.toFixed(decimals));
}

function randomInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createEventId(roomId, sequence) {
  return `evt-${roomId}-${Date.now()}-${sequence}`;
}

function getRoomId(roomNumber) {
  return `R${String(roomNumber).padStart(3, "0")}`;
}

function classifyRoomScenario() {
  const scenarios = ["normal", "hot", "crowded", "humid", "poor_air", "empty"];
  return scenarios[randomInteger(0, scenarios.length - 1)];
}

function generateTelemetry(roomNumber, sequence) {
  const roomId = getRoomId(roomNumber);
  const scenario = classifyRoomScenario();

  let temperatureC;
  let humidityPct;
  let occupancy;
  let co2Ppm;

  switch (scenario) {
    case "hot":
      temperatureC = randomFloat(28, 35);
      humidityPct = randomInteger(45, 70);
      occupancy = randomInteger(2, 12);
      co2Ppm = randomInteger(700, 1200);
      break;

    case "crowded":
      temperatureC = randomFloat(25, 31);
      humidityPct = randomInteger(50, 75);
      occupancy = randomInteger(15, 30);
      co2Ppm = randomInteger(1000, 1800);
      break;

    case "humid":
      temperatureC = randomFloat(24, 30);
      humidityPct = randomInteger(70, 85);
      occupancy = randomInteger(3, 15);
      co2Ppm = randomInteger(700, 1300);
      break;

    case "poor_air":
      temperatureC = randomFloat(23, 30);
      humidityPct = randomInteger(45, 75);
      occupancy = randomInteger(8, 25);
      co2Ppm = randomInteger(1500, 2200);
      break;

    case "empty":
      temperatureC = randomFloat(20, 28);
      humidityPct = randomInteger(35, 65);
      occupancy = 0;
      co2Ppm = randomInteger(400, 650);
      break;

    case "normal":
    default:
      temperatureC = randomFloat(21, 26);
      humidityPct = randomInteger(40, 60);
      occupancy = randomInteger(1, 8);
      co2Ppm = randomInteger(450, 900);
      break;
  }

  return {
    eventId: createEventId(roomId, sequence),
    buildingId: BUILDING_ID,
    roomId,
    deviceId: `sim-${roomId}`,
    timestamp: new Date().toISOString(),
    temperatureC,
    humidityPct,
    occupancy,
    co2Ppm,
    sequence,
    scenario
  };
}

function buildTelemetryTopic(telemetry) {
  return `${MQTT_TOPIC_PREFIX}/${telemetry.buildingId}/${telemetry.roomId}/telemetry`;
}

function publishTelemetryBatch(client, roomCount, sequence) {
  console.log(`\n--- MQTT telemetry batch ${sequence} ---`);

  for (let roomNumber = 1; roomNumber <= roomCount; roomNumber++) {
    const telemetry = generateTelemetry(roomNumber, sequence);
    const topic = buildTelemetryTopic(telemetry);
    const payload = JSON.stringify(telemetry);

    client.publish(topic, payload, { qos: 0 }, (error) => {
      if (error) {
        console.error(`Publish failed for ${topic}:`, error.message);
        return;
      }

      console.log(`Published to ${topic}: ${payload}`);
    });
  }
}

function printTelemetryBatch(roomCount, sequence) {
  console.log(`\n--- Telemetry batch ${sequence} ---`);

  for (let roomNumber = 1; roomNumber <= roomCount; roomNumber++) {
    const telemetry = generateTelemetry(roomNumber, sequence);
    console.log(JSON.stringify(telemetry));
  }
}

function startConsoleSimulator(roomCount, intervalMs) {
  let sequence = 1;

  console.log("Smart AC Room Simulator started in console mode");
  console.log(`Building ID: ${BUILDING_ID}`);
  console.log(`Simulated rooms: ${roomCount}`);
  console.log(`Interval: ${intervalMs} ms`);
  console.log("Press Ctrl + C to stop the simulator.");

  printTelemetryBatch(roomCount, sequence);

  setInterval(() => {
    sequence += 1;
    printTelemetryBatch(roomCount, sequence);
  }, intervalMs);
}

function startMqttSimulator(roomCount, intervalMs) {
  let sequence = 1;

  console.log("Smart AC Room Simulator started in MQTT mode");
  console.log(`Broker: ${MQTT_BROKER_URL}`);
  console.log(`Topic format: smartac/${BUILDING_ID}/{roomId}/telemetry`);
  console.log(`Simulated rooms: ${roomCount}`);
  console.log(`Interval: ${intervalMs} ms`);
  console.log("Press Ctrl + C to stop the simulator.");

  const client = mqtt.connect(MQTT_BROKER_URL);

  client.on("connect", () => {
    console.log("Connected to MQTT broker");

    publishTelemetryBatch(client, roomCount, sequence);

    setInterval(() => {
      sequence += 1;
      publishTelemetryBatch(client, roomCount, sequence);
    }, intervalMs);
  });

  client.on("error", (error) => {
    console.error("MQTT connection error:", error.message);
  });
}

function startSimulator() {
  const roomCount = getArgumentValue("--rooms", DEFAULT_ROOMS);
  const intervalMs = getArgumentValue("--interval", DEFAULT_INTERVAL_MS);
  const mqttMode = hasFlag("--mqtt");

  if (mqttMode) {
    startMqttSimulator(roomCount, intervalMs);
  } else {
    startConsoleSimulator(roomCount, intervalMs);
  }
}

startSimulator();