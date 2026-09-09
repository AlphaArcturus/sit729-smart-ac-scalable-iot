// fuzzyComfort.js
// Rule-based fuzzy-style comfort decision logic for the smart AC system.
// The design is inspired by fuzzy comfort control, but kept simple and explainable
// for the SIT729 scalable IoT prototype.

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function calculateTemperatureScore(temperatureC) {
  if (temperatureC <= 20) return 0.1;
  if (temperatureC <= 24) return 0.3;
  if (temperatureC <= 28) return 0.6;
  if (temperatureC <= 32) return 0.8;
  return 1.0;
}

function calculateOccupancyScore(occupancy) {
  if (occupancy === 0) return 0.0;
  if (occupancy <= 5) return 0.25;
  if (occupancy <= 15) return 0.55;
  if (occupancy <= 25) return 0.8;
  return 1.0;
}

function calculateHumidityScore(humidityPct) {
  if (humidityPct <= 40) return 0.2;
  if (humidityPct <= 60) return 0.4;
  if (humidityPct <= 75) return 0.7;
  return 1.0;
}

function calculateAirQualityScore(co2Ppm) {
  if (co2Ppm <= 700) return 0.2;
  if (co2Ppm <= 1000) return 0.4;
  if (co2Ppm <= 1500) return 0.7;
  return 1.0;
}

function decideComfortAction(telemetry) {
  const temperatureC = Number(telemetry.temperatureC);
  const humidityPct = Number(telemetry.humidityPct);
  const occupancy = Number(telemetry.occupancy);
  const co2Ppm = Number(telemetry.co2Ppm);

  const tempScore = calculateTemperatureScore(temperatureC);
  const occupancyScore = calculateOccupancyScore(occupancy);
  const humidityScore = calculateHumidityScore(humidityPct);
  const airQualityScore = calculateAirQualityScore(co2Ppm);

  // Weighted fuzzy-style comfort load.
  // Temperature and occupancy have stronger influence because they directly affect AC demand.
  const comfortLoad =
    tempScore * 0.45 +
    occupancyScore * 0.25 +
    humidityScore * 0.15 +
    airQualityScore * 0.15;

  let comfortLevel = "comfortable";
  let recommendedSetpoint = 24;
  let fanSpeed = "medium";
  let mode = "cool";
  let actionRequired = false;
  const reasons = [];

  if (occupancy === 0) {
    comfortLevel = "empty_room";
    recommendedSetpoint = 26;
    fanSpeed = "low";
    mode = "eco";
    actionRequired = true;
    reasons.push("Room is empty, so energy-saving mode is recommended");
  } else if (comfortLoad >= 0.8) {
    comfortLevel = "critical_discomfort";
    recommendedSetpoint = 20;
    fanSpeed = "high";
    mode = "cool";
    actionRequired = true;
    reasons.push("Combined temperature, occupancy, humidity or CO2 load is critical");
  } else if (comfortLoad >= 0.65) {
    comfortLevel = "too_hot_or_crowded";
    recommendedSetpoint = 21;
    fanSpeed = "high";
    mode = "cool";
    actionRequired = true;
    reasons.push("Room conditions suggest high cooling demand");
  } else if (comfortLoad >= 0.45) {
    comfortLevel = "slightly_uncomfortable";
    recommendedSetpoint = 23;
    fanSpeed = "medium";
    mode = "cool";
    actionRequired = true;
    reasons.push("Room conditions are slightly above comfort range");
  } else {
    comfortLevel = "comfortable";
    recommendedSetpoint = 24;
    fanSpeed = "low";
    mode = "auto";
    actionRequired = false;
    reasons.push("Room conditions are within the normal comfort range");
  }

  if (co2Ppm >= 1500) {
    fanSpeed = "high";
    actionRequired = true;
    reasons.push("CO2 is high, so stronger ventilation is recommended");
  }

  if (humidityPct >= 75) {
    actionRequired = true;
    reasons.push("Humidity is high and may reduce perceived comfort");
  }

  return {
    eventId: telemetry.eventId,
    buildingId: telemetry.buildingId,
    roomId: telemetry.roomId,
    deviceId: telemetry.deviceId,
    timestamp: telemetry.timestamp,
    decisionTimestamp: new Date().toISOString(),
    input: {
      temperatureC,
      humidityPct,
      occupancy,
      co2Ppm
    },
    fuzzyScores: {
      temperature: Number(tempScore.toFixed(2)),
      occupancy: Number(occupancyScore.toFixed(2)),
      humidity: Number(humidityScore.toFixed(2)),
      airQuality: Number(airQualityScore.toFixed(2)),
      comfortLoad: Number(clamp(comfortLoad, 0, 1).toFixed(2))
    },
    decision: {
      comfortLevel,
      recommendedSetpoint,
      fanSpeed,
      mode,
      actionRequired,
      reasons
    },
    command: {
      targetDeviceId: `ac-${telemetry.roomId}`,
      commandType: "setAirConditioning",
      power: true,
      mode,
      targetTemperature: recommendedSetpoint,
      fanSpeed
    }
  };
}

module.exports = {
  decideComfortAction
};