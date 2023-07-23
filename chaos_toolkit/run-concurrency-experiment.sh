#!/bin/sh

AWS_REGION="eu-central-1"
LAMBDA_FUNCTION_NAME="ServerlessChaosStack-chaos-experiment"
ALARM_NAME="TooManyLambdaInvocationThrottles"
CONCURRENCY=5
DURATION=300

export AWS_REGION LAMBDA_FUNCTION_NAME ALARM_NAME CONCURRENCY DURATION

chaos run --hypothesis-strategy=continuously \
          --hypothesis-frequency=10 \
          --fail-fast \
          --rollback-strategy=always \
          lambda-concurrency-experiment.json