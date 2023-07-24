#!/bin/sh

# replace with your own values from the CF outputs
# AWS region and SQS queue URL
AWS_REGION="eu-central-1"
SQS_QUEUE_URL='https://sqs.eu-central-1.amazonaws.com/057611153267/chaosLambda-TriggerQueue'

# Number of messages to generate and send in each batch
BATCH_SIZE=10

# Function to generate a single message
generate_message() {
  # Modify this function to generate your custom messages
  # For example, you can use random data or data from external sources
  echo "Message: $(date +%s)"
}

# Function to send messages in batches to SQS
send_batch_messages() {
  local batch=()
  local count=0

  while IFS= read -r message; do
    batch+=("{\"Id\":\"$count\",\"MessageBody\":\"$message\"}")
    count=$((count + 1))

    if [ ${#batch[@]} -eq $BATCH_SIZE ]; then
      aws sqs send-message-batch --queue-url "$SQS_QUEUE_URL" --entries "${batch[@]}" --region "$AWS_REGION"
      batch=()
    fi
  done

  if [ ${#batch[@]} -gt 0 ]; then
    aws sqs send-message-batch --queue-url "$SQS_QUEUE_URL" --entries "${batch[@]}" --region "$AWS_REGION"
  fi
}

# Main script
main() {
  echo "Generating and sending messages to SQS queue..."
  for ((i = 1; i <= 200; i++)); do
    generate_message
  done | send_batch_messages

  echo "All messages sent successfully."
}

main