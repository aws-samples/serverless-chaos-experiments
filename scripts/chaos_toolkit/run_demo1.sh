#!/bin/sh

AWS_CONFIGURED_REGION=$(aws configure get region)
echo "AWS Region (default: $AWS_CONFIGURED_REGION):"
read AWS_REGION
AWS_REGION="${AWS_REGION:=$AWS_CONFIGURED_REGION}"

echo "AWS Lambda Funtion Name:"
read LAMBDA_FUNCTION_NAME

echo "AWS CW Alarm Name:"
read ALARM_NAME

echo "Function Concurrency (default: 5):"
read CONCURRENCY
CONCURRENCY="${CONCURRENCY:=5}"

echo "Experiment Duration in seconds (default: 300):"
read DURATION
DURATION="${DURATION:=300}"

export AWS_REGION LAMBDA_FUNCTION_NAME ALARM_NAME CONCURRENCY DURATION

chaos run --hypothesis-strategy=continuously \
          --hypothesis-frequency=10 \
          --fail-fast \
          --rollback-strategy=always \
          ./experiments/demo1.json
