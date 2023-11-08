import boto3
import os
import importlib.util
from chaos_lambda import inject_fault

os.environ['CHAOS_PARAM'] = '/ChaosInjection/ChaosConfigSsmParameter'

ssm = boto3.client('ssm')
function_name  = os.environ['AWS_LAMBDA_FUNCTION_NAME']
filename, handler_name = ssm.get_parameter(Name= '/ChaosInjection/' + function_name + '_handler_ssmparam')['Parameter']['Value'].split('.')

# Load the module
try:
    spec = importlib.util.spec_from_file_location(filename, '/var/task/lambda_function.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
except:
    raise Exception('Error loading module')

# Get the function
original_handler = getattr(module, handler_name)

@inject_fault
def layer_handler(event, context):
    return original_handler(event, context)
