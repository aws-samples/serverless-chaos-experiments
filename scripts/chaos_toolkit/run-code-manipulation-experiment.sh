#!/bin/sh

# replace with your own values from the CF outputs
FUNCTION_NAME="Lambda_with_Chaos_Lambda"
PARAMETER_NAME="chaoslambda.config"
ALARM_NAME="chaosLambda-tooManyFunctionThrottles"

# change according to your needs
AWS_REGION="eu-central-1"
CHAOS_TYPE="status_code" # latency, exception or status_code
ENABLED="true"
DELAY="500" # in milliseconds
ERROR_CODE="404"
EXCEPTION_MSG="This is chaos at its best."
RATE="1" # value between 0 and 1
DURATION=120

export AWS_REGION FUNCTION_NAME PARAMETER_NAME ALARM_NAME CHAOS_TYPE ENABLED DELAY ERROR_CODE EXCEPTION_MSG RATE DURATION

chaos run --hypothesis-strategy=continuously \
          --hypothesis-frequency=10 \
          --fail-fast \
          --rollback-strategy=always \
          code-manipulation-experiment.json