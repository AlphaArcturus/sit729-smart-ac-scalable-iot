# SIT729 Scalable Smart Air-Conditioning IoT System

## Project Overview

This project implements a scalable smart air-conditioning system for a large building. The system uses simulated IoT room nodes to generate telemetry such as temperature, humidity, occupancy and CO2 level. Node-RED is used for flow-based validation, filtering and routing. Node.js microservices are used for comfort decision-making, telemetry processing and dashboard/API access. AWS will be used for cloud deployment, monitoring, security and automatic scaling evidence.

## Main Technologies

- Node.js
- Node-RED
- MQTT / HTTP
- Docker
- Amazon Web Services
- DynamoDB
- Amazon ECS / Fargate
- Amazon CloudWatch

## Project Architecture

Simulated room nodes generate telemetry events. Node-RED receives and processes the messages, then forwards validated events to Node.js microservices. The comfort service calculates the recommended air-conditioning setpoint using fuzzy/rule-based logic. The telemetry service stores sensor and decision records. The dashboard service provides access to current room status and alerts.

## Folder Structure

```text
simulator/
  room-simulator.js
  load-test.js

node-red/
  flows.json

services/
  comfort-service/
  telemetry-service/
  dashboard-service/

docs/
  aws-screenshots/
  node-red-screenshots/
  test-results/
  ```

## Planned Scaling Test Targets

The simulator supports configurable room counts and publish intervals. The throughput values below are planned estimates based on this formula:

**Estimated throughput = simulated rooms / publish interval in seconds**

### Local baseline test

- Simulated rooms: 5
- Publish interval: 3000 ms
- Estimated throughput: about 1.7 messages/second
- Target outcome: dashboard updates correctly and all Docker services remain healthy.

### Local small-load test

- Simulated rooms: 25
- Publish interval: 1000 ms
- Estimated throughput: about 25 messages/second
- Target outcome: telemetry records continue increasing, the dashboard remains usable, and the stats endpoint responds normally.

### Local medium-load test

- Simulated rooms: 100
- Publish interval: 1000 ms
- Estimated throughput: about 100 messages/second
- Target outcome: services do not crash, telemetry storage continues, and the dashboard can still show the latest room state.

### AWS scaling test

- Simulated rooms: 250 to 500
- Publish interval: 1000 ms
- Estimated throughput: about 250 to 500 messages/second
- Target outcome: CloudWatch metrics show increased workload, and scaling activity can be captured as evidence.

These are planned scaling targets rather than final measured results. The final report will compare the planned targets with the actual local and AWS test results.