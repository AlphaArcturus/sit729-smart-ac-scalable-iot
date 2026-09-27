const {
  classifyComfort,
  shouldForwardToCloud
} = require("./edge-filter-policy");

const scenarios = [
  {
    name: "Normal building day",
    totalEvents: 1000,
    distribution: {
      comfortable: 60,
      empty_room: 10,
      slightly_uncomfortable: 20,
      too_hot_or_crowded: 7,
      critical_discomfort: 3
    }
  },
  {
    name: "Busy warm afternoon",
    totalEvents: 1000,
    distribution: {
      comfortable: 35,
      empty_room: 5,
      slightly_uncomfortable: 35,
      too_hot_or_crowded: 18,
      critical_discomfort: 7
    }
  },
  {
    name: "Mostly stable after control action",
    totalEvents: 1000,
    distribution: {
      comfortable: 75,
      empty_room: 10,
      slightly_uncomfortable: 10,
      too_hot_or_crowded: 4,
      critical_discomfort: 1
    }
  }
];

const sampleRates = [3, 5, 10];

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function randomInt(min, max) {
  return Math.floor(randomBetween(min, max + 1));
}

function scenarioForIndex(index, distribution) {
  const bucket = index % 100;
  let cumulative = 0;

  for (const [scenario, percent] of Object.entries(distribution)) {
    cumulative += percent;
    if (bucket < cumulative) return scenario;
  }

  return "comfortable";
}

function generateTelemetry(index, scenario) {
  const roomId = `R${String((index % 100) + 1).padStart(3, "0")}`;

  const base = {
    eventId: `evt-${index}`,
    buildingId: "B01",
    roomId,
    deviceId: `sim-${roomId}`,
    timestamp: new Date().toISOString(),
    sequence: index,
    scenario
  };

  if (scenario === "comfortable") {
    return {
      ...base,
      temperatureC: Number(randomBetween(22, 25.5).toFixed(1)),
      humidityPct: Number(randomBetween(40, 60).toFixed(1)),
      occupancy: randomInt(1, 8),
      co2Ppm: randomInt(500, 850)
    };
  }

  if (scenario === "empty_room") {
    return {
      ...base,
      temperatureC: Number(randomBetween(22, 26).toFixed(1)),
      humidityPct: Number(randomBetween(40, 60).toFixed(1)),
      occupancy: 0,
      co2Ppm: randomInt(450, 750)
    };
  }

  if (scenario === "slightly_uncomfortable") {
    return {
      ...base,
      temperatureC: Number(randomBetween(27, 29.5).toFixed(1)),
      humidityPct: Number(randomBetween(60, 72).toFixed(1)),
      occupancy: randomInt(5, 14),
      co2Ppm: randomInt(900, 1200)
    };
  }

  if (scenario === "too_hot_or_crowded") {
    return {
      ...base,
      temperatureC: Number(randomBetween(30, 33).toFixed(1)),
      humidityPct: Number(randomBetween(60, 75).toFixed(1)),
      occupancy: randomInt(16, 21),
      co2Ppm: randomInt(1300, 1650)
    };
  }

  return {
    ...base,
    temperatureC: Number(randomBetween(34, 37).toFixed(1)),
    humidityPct: Number(randomBetween(65, 85).toFixed(1)),
    occupancy: randomInt(22, 30),
    co2Ppm: randomInt(1700, 2200)
  };
}

function evaluateScenario(scenarioConfig, sampleRate) {
  let baselineForwarded = 0;
  let adaptiveForwarded = 0;
  let edgeFiltered = 0;

  let criticalGenerated = 0;
  let criticalForwarded = 0;
  let warningGenerated = 0;
  let warningForwarded = 0;
  let lowPriorityGenerated = 0;
  let lowPriorityForwarded = 0;

  const comfortCounts = {};

  for (let i = 1; i <= scenarioConfig.totalEvents; i++) {
    const scenarioName = scenarioForIndex(i, scenarioConfig.distribution);
    const event = generateTelemetry(i, scenarioName);
    const comfortLevel = classifyComfort(event);

    comfortCounts[comfortLevel] = (comfortCounts[comfortLevel] || 0) + 1;

    baselineForwarded++;

    const decision = shouldForwardToCloud(event, {
      lowPrioritySampleRate: sampleRate
    });

    if (decision.priority === "critical") {
      criticalGenerated++;
    } else if (decision.priority === "warning") {
      warningGenerated++;
    } else {
      lowPriorityGenerated++;
    }

    if (decision.forward) {
      adaptiveForwarded++;

      if (decision.priority === "critical") {
        criticalForwarded++;
      } else if (decision.priority === "warning") {
        warningForwarded++;
      } else {
        lowPriorityForwarded++;
      }
    } else {
      edgeFiltered++;
    }
  }

  const cloudRequestReductionPercent =
    ((baselineForwarded - adaptiveForwarded) / baselineForwarded) * 100;

  const criticalEventPreservationPercent =
    criticalGenerated === 0 ? 100 : (criticalForwarded / criticalGenerated) * 100;

  const warningEventPreservationPercent =
    warningGenerated === 0 ? 100 : (warningForwarded / warningGenerated) * 100;

  return {
    scenario: scenarioConfig.name,
    totalEvents: scenarioConfig.totalEvents,
    lowPrioritySampleRate: `1 in ${sampleRate}`,
    comfortDistribution: comfortCounts,
    baselineCloudForwardedEvents: baselineForwarded,
    adaptiveCloudForwardedEvents: adaptiveForwarded,
    edgeFilteredEvents: edgeFiltered,
    cloudRequestReductionPercent: Number(cloudRequestReductionPercent.toFixed(2)),
    criticalEventPreservationPercent: Number(criticalEventPreservationPercent.toFixed(2)),
    warningEventPreservationPercent: Number(warningEventPreservationPercent.toFixed(2)),
    lowPriorityGenerated,
    lowPriorityForwarded
  };
}

const results = [];

for (const scenario of scenarios) {
  for (const rate of sampleRates) {
    results.push(evaluateScenario(scenario, rate));
  }
}

console.log(JSON.stringify({
  technique: "Adaptive edge filtering for cloud-edge scalable Smart AC IoT",
  baseline: "Forward every telemetry event to cloud microservices",
  adaptiveDesign: "Forward all warning/critical events and sample low-priority events at the edge",
  results
}, null, 2));