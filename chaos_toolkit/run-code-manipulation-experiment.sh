#!/bin/sh

AWS_REGION="eu-central-1"
FUNCTION_NAME="ServerlessChaosStack-chaos-experiment"
PARAMETER_NAME="chaoslambda.config"
ALARM_NAME="TooManyLambdaInvocationThrottles"
CHAOS_TYPE="status_code" # latency, exception or status_code
ENABLED="true"
DELAY="500" # in milliseconds
ERROR_CODE="404"
EXCEPTION_MSG="This is chaos at its best."
RATE="1" # value between 0 and 1
DURATION=60

export AWS_REGION FUNCTION_NAME PARAMETER_NAME ALARM_NAME CHAOS_TYPE ENABLED DELAY ERROR_CODE EXCEPTION_MSG RATE DURATION

chaos run --hypothesis-strategy=continuously \
          --hypothesis-frequency=10 \
          --fail-fast \
          --rollback-strategy=always \
          code-manipulation-experiment.json