/**
 * HD Evaluation Script V2: Adaptive Edge Filtering for Scalable Smart AC IoT
 *
 * This version uses a controlled building scenario:
 * - around 60% comfortable events
 * - around 10% empty-room events
 * - around 20% slightly uncomfortable events
 * - around 7% too hot/crowded events
 * - around 3% critical discomfort events
 *
 * This makes the HD evaluation more realistic because most building telemetry
 * is usually normal, while warning/critical events must still be preserved.
 */

const TOTAL_EVENTS = Number(process.argv[2]) || 1000;
const SAMPLE_RATE_LOW_PRIORITY = 5; // forward every 5th comfortable/empty-room event

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function randomInt(min, max) {
  return Math.floor(randomBetween(min, max + 1));
}

function generateTelemetry(index) {
  const roomId = `R${String((index % 100) + 1).padStart(3, "0")}`;
  const bucket = index % 100;

  let scenario;

  if (bucket < 60) {
    scenario = "comfortable";
  } else if (bucket < 70) {
    scenario = "empty_room";
  } else if (bucket < 90) {
    scenario = "slightly_uncomfortable";
  } else if (bucket < 97) {
    scenario = "too_hot_or_crowded";
  } else {
    scenario = "critical_discomfort";
  }

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

function classifyComfort(event) {
  const { temperatureC, humidityPct, occupancy, co2Ppm } = event;

  if (temperatureC >= 34 || co2Ppm >= 1700 || occupancy >= 22) {
    return "critical_discomfort";
  }

  if (temperatureC >= 30 || co2Ppm >= 1300 || occupancy >= 16) {
    return "too_hot_or_crowded";
  }

  if (temperatureC >= 27 || humidityPct >= 70 || co2Ppm >= 1000) {
    return "slightly_uncomfortable";
  }

  if (occupancy === 0) {
    return "empty_room";
  }

  return "comfortable";
}

function adaptiveEdgeFilter(event, comfortLevel) {
  const importantLevels = [
    "critical_discomfort",
    "too_hot_or_crowded",
    "slightly_uncomfortable"
  ];

  if (importantLevels.includes(comfortLevel)) {
    return {
      forward: true,
      reason: "important_event_forwarded"
    };
  }

  if (event.sequence % SAMPLE_RATE_LOW_PRIORITY === 0) {
    return {
      forward: true,
      reason: "sampled_low_priority_event"
    };
  }

  return {
    forward: false,
    reason: "low_priority_event_filtered_at_edge"
  };
}

function runEvaluation() {
  const comfortCounts = {};

  let baselineForwarded = 0;
  let adaptiveForwarded = 0;
  let adaptiveFiltered = 0;

  let criticalGenerated = 0;
  let criticalForwarded = 0;
  let warningGenerated = 0;
  let warningForwarded = 0;
  let lowPriorityGenerated = 0;
  let lowPriorityForwarded = 0;

  for (let i = 1; i <= TOTAL_EVENTS; i++) {
    const event = generateTelemetry(i);
    const comfortLevel = classifyComfort(event);

    comfortCounts[comfortLevel] = (comfortCounts[comfortLevel] || 0) + 1;

    // Baseline forwards every event to cloud.
    baselineForwarded++;

    // Count event priority.
    if (comfortLevel === "critical_discomfort") {
      criticalGenerated++;
    } else if (
      comfortLevel === "too_hot_or_crowded" ||
      comfortLevel === "slightly_uncomfortable"
    ) {
      warningGenerated++;
    } else {
      lowPriorityGenerated++;
    }

    // Adaptive filtering.
    const decision = adaptiveEdgeFilter(event, comfortLevel);

    if (decision.forward) {
      adaptiveForwarded++;

      if (comfortLevel === "critical_discomfort") {
        criticalForwarded++;
      } else if (
        comfortLevel === "too_hot_or_crowded" ||
        comfortLevel === "slightly_uncomfortable"
      ) {
        warningForwarded++;
      } else {
        lowPriorityForwarded++;
      }
    } else {
      adaptiveFiltered++;
    }
  }

  const cloudRequestReductionPercent =
    ((baselineForwarded - adaptiveForwarded) / baselineForwarded) * 100;

  const criticalEventPreservationPercent =
    criticalGenerated === 0 ? 100 : (criticalForwarded / criticalGenerated) * 100;

  const warningEventPreservationPercent =
    warningGenerated === 0 ? 100 : (warningForwarded / warningGenerated) * 100;

  const results = {
    configuration: {
      totalGeneratedEvents: TOTAL_EVENTS,
      lowPrioritySampleRate: `1 in ${SAMPLE_RATE_LOW_PRIORITY}`,
      scenarioDistribution:
        "60% comfortable, 10% empty-room, 20% slightly uncomfortable, 7% too hot/crowded, 3% critical"
    },
    comfortDistribution: comfortCounts,
    baselineDesign: {
      generatedEvents: TOTAL_EVENTS,
      cloudForwardedEvents: baselineForwarded,
      forwardingRatePercent: 100
    },
    adaptiveEdgeFilteringDesign: {
      generatedEvents: TOTAL_EVENTS,
      cloudForwardedEvents: adaptiveForwarded,
      edgeFilteredEvents: adaptiveFiltered,
      cloudRequestReductionPercent: Number(cloudRequestReductionPercent.toFixed(2)),
      criticalEventsGenerated: criticalGenerated,
      criticalEventsForwarded: criticalForwarded,
      criticalEventPreservationPercent: Number(criticalEventPreservationPercent.toFixed(2)),
      warningEventsGenerated: warningGenerated,
      warningEventsForwarded: warningForwarded,
      warningEventPreservationPercent: Number(warningEventPreservationPercent.toFixed(2)),
      lowPriorityEventsGenerated: lowPriorityGenerated,
      lowPriorityEventsForwarded: lowPriorityForwarded
    },
    interpretation: [
      "The baseline design forwards every telemetry event to cloud microservices.",
      "The adaptive edge-filtering design forwards all warning and critical events immediately.",
      "Comfortable and empty-room events are sampled at the edge to reduce unnecessary cloud traffic.",
      "This reduces cloud workload before ECS/Fargate auto-scaling is required."
    ]
  };

  console.log(JSON.stringify(results, null, 2));
}

runEvaluation();