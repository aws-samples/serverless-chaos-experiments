import os
from time import sleep
from chaos_lambda import inject_fault

# this should be set as a Lambda environment variable
os.environ['CHAOS_PARAM'] = 'chaoslambda.config'

@inject_fault
def lambda_handler(event, context):
    print(event)
    sleep(2)
    return {
        'statusCode': 200,
        'body': 'Hello from Lambda!'
    }