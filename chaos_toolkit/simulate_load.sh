#!/bin/sh

# replace with your own values from the CF outputs
SQS_URL='https://sqs.eu-central-1.amazonaws.com/057611153267/chaosLambda-TriggerQueue'

echo Starting the experiment
# aws sqs send-message --queue-url $SQS_URL --message-body "IOT-1 Temp: 51C"

for index in {1..50}
do
   echo "Sending message nr. $index"
   aws sqs send-message --queue-url $SQS_URL --message-body "Message nr: $index" > /dev/null
done