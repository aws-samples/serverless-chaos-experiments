#!/bin/sh

AWS_REGION="eu-central-1"
LAMBDA_FUNCTION_NAME="Lambda_with_Chaos_Lambda"
ALARM_NAME="chaosLambda-tooManyFunctionThrottles"
CONCURRENCY=2
DURATION=300

export AWS_REGION LAMBDA_FUNCTION_NAME ALARM_NAME CONCURRENCY DURATION

chaos run --hypothesis-strategy=continuously \
          --hypothesis-frequency=10 \
          --fail-fast \
          --rollback-strategy=always \
          lambda-concurrency-experiment.json