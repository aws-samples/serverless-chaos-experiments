import { Stack, Duration } from "aws-cdk-lib";
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as pythonLambda from '@aws-cdk/aws-lambda-python-alpha';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import { FisHandlerReplacementExperiment } from "./fis/fis-handler-replacement-experiment";


export class DemoTwo extends Stack {
    constructor(scope: Construct, id: string) {
        super(scope, id);

        // TODO change value here
        const chaosExperimentConfiguration = '{ "fault_type": "exception", "is_enabled": false, "delay": 400, "error_code": 404, "exception_msg": "This is chaos", "rate": 1}';


        // ------------------- LAMBDA FUNCTION -------------------------------

        const chaosLambdaFunction = new lambda.Function(this, 'chaosLambdaDemo2', {
            handler: 'lambda_function.lambda_handler',
            functionName: `${this.stackName}-Func`,
            description: 'Simple hello_world lambda function that will be used in chaos experiments',
            code: lambda.Code.fromAsset('lib/resources/lambda/hello_world', {}),
            runtime: lambda.Runtime.PYTHON_3_11,
            tracing: lambda.Tracing.ACTIVE
        });

        // permissions to SSM Parameter store
        // these are overly permissive and should be only given during the experiment
        const ssmPermissions = new iam.PolicyStatement({
            actions: [
                "ssm:PutParameter",
                "ssm:LabelParameterVersion",
                "ssm:DescribeDocumentParameters",
                "ssm:GetParameters",
                "ssm:GetParameter",
                "ssm:DescribeParameters",
            ],
            resources: [
                `arn:aws:ssm:${this.region}:${this.account}:parameter/ChaosInjection/*`
            ],
        });

        chaosLambdaFunction.role?.attachInlinePolicy(
            new iam.Policy(this, 'additional-ssm-policy', {
                statements: [
                    ssmPermissions
                ]
            })
        );


        // ------------------- SNS TOPIC -------------------------------------

        const snsTopic = new sns.Topic(this, 'alarmTopicDemo2', {
            topicName: `${this.stackName}-AlarmTopic`,
            displayName: 'Topic for general alerting and rollback functionality'
        });


        // ------------------- CLOUDWATCH ALARM ------------------------------

        // TODO create composite alarm, duration of Lambda func, exceptions, status_code
        const functionThrottles = chaosLambdaFunction.metricErrors({
            period: Duration.minutes(1),
        });

        const alarm = new cloudwatch.Alarm(this, 'cloudWatchAlarmDemo2', {
            alarmName: `${this.stackName}-CloudWatchAlarm`,
            alarmDescription: 'Checks if we have too many function errors for the test function.',

            metric: functionThrottles,
            threshold: 10,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            evaluationPeriods: 1,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,

            actionsEnabled: true
        });

        alarm.addAlarmAction(new cloudwatchActions.SnsAction(snsTopic));

        // -------------------- Parameter Store ------------------------------

        const chaosParameter = new ssm.StringParameter(this, 'chaosConfigSsmParameterDemo2', {
            parameterName: '/ChaosInjection/ChaosConfigSsmParameter',
            stringValue: chaosExperimentConfiguration,
        });

        // -------------------- Chaos Lambda Layer ---------------------------

        const pythonChaosLayer = new pythonLambda.PythonLayerVersion(this, 'chaosPythonLambdaLayerDemo2', {
            entry: 'lib/resources/layers/pychaos/python/',
            compatibleRuntimes: [lambda.Runtime.PYTHON_3_11],
            layerVersionName: `${this.stackName}-chaosPythonLayer`,
        });

        // -------------------- FIS Experiment -------------------------------

        const fisExperiment = new FisHandlerReplacementExperiment(this, 'fisHandlerReplacementExperiment', {
            chaosParameterName: chaosParameter.parameterName,
            lambdaFunctionArn: chaosLambdaFunction.functionArn,
            lambdaName: chaosLambdaFunction.functionName,
            lambdaLayerArn: pythonChaosLayer.layerVersionArn,
            cloudWatchAlarmArn: alarm.alarmArn
        });

    }
}