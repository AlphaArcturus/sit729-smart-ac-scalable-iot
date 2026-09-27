/**
 * HD Edge Filtering Policy for Smart AC IoT
 *
 * This module represents the reusable edge filtering logic.
 * It can be used by Node-RED, simulators, or benchmark scripts before
 * forwarding telemetry to cloud microservices.
 */

const DEFAULT_LOW_PRIORITY_SAMPLE_RATE = 5;

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

function getPriority(comfortLevel) {
  if (comfortLevel === "critical_discomfort") {
    return "critical";
  }

  if (
    comfortLevel === "too_hot_or_crowded" ||
    comfortLevel === "slightly_uncomfortable"
  ) {
    return "warning";
  }

  return "low_priority";
}

function shouldForwardToCloud(event, options = {}) {
  const sampleRate =
    options.lowPrioritySampleRate || DEFAULT_LOW_PRIORITY_SAMPLE_RATE;

  const comfortLevel = classifyComfort(event);
  const priority = getPriority(comfortLevel);

  if (priority === "critical" || priority === "warning") {
    return {
      forward: true,
      comfortLevel,
      priority,
      reason: "important_event_forwarded"
    };
  }

  if (event.sequence % sampleRate === 0) {
    return {
      forward: true,
      comfortLevel,
      priority,
      reason: "sampled_low_priority_event"
    };
  }

  return {
    forward: false,
    comfortLevel,
    priority,
    reason: "low_priority_event_filtered_at_edge"
  };
}

module.exports = {
  DEFAULT_LOW_PRIORITY_SAMPLE_RATE,
  classifyComfort,
  getPriority,
  shouldForwardToCloud
};