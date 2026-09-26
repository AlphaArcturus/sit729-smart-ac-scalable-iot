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
  
## Planned Scaling Test Targets

The local prototype will be used to confirm the end-to-end IoT pipeline before AWS deployment. The AWS phase will then test how the system behaves as the number of simulated rooms increases.

| Test Level | Simulated Rooms | Publish Interval | Approx. Throughput | Target Outcome |
|---|---:|---:|---:|---|
| Baseline | 5 | 3000 ms | ~1.7 msg/sec | Dashboard updates correctly and all services remain healthy |
| Small Load | 25 | 1000 ms | ~25 msg/sec | Telemetry stats endpoint responds consistently under local Docker |
| Medium Load | 100 | 1000 ms | ~100 msg/sec | No service crash, telemetry records continue increasing |
| AWS Scaling Test | 250–500 | 1000 ms | ~250–500 msg/sec | CloudWatch metrics show increased load and scaling activity |

The main response-time target is to keep the telemetry statistics endpoint responsive during increasing load. In the AWS phase, CloudWatch metrics, service logs and scaling activity will be used as evidence.