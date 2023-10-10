import { Stack, Duration } from "aws-cdk-lib";
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';


export class DemoThree extends Stack {
    constructor(scope: Construct, id: string) {
        super(scope, id);

        // ------------------- CHAOS LAMBDA LAYER -------------------------------

        // Check latest version here: https://github.com/aws-cli-tools/chaos-lambda-extension/blob/main/LAYERS.md
        // Leave account number as the Layers are hosted there
        const chaosLayerVersion = 9;
        const chaosLayerArn = `arn:aws:lambda:${this.region}:871265522301:layer:chaos-lambda-extension-x86_64-unknown-linux-gnu-release:${chaosLayerVersion}`;

        const chaosLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'chaos', chaosLayerArn);

        // ------------------- LAMBDA FUNCTION -------------------------------

        const chaosLambdaFunction = new lambda.Function(this, 'chaosLambdaDemo3', {
            handler: 'lambda_function.lambda_handler',
            functionName: `${this.stackName}-Func`,
            description: 'Simple hello_world lambda function that will be used in chaos experiments',
            code: lambda.Code.fromAsset('lib/resources/lambda/hello_world', {}),
            runtime: lambda.Runtime.PYTHON_3_11,
            layers: [chaosLayer],
            tracing: lambda.Tracing.ACTIVE,
            timeout: Duration.seconds(30),
            environment: {
                'AWS_LAMBDA_EXEC_WRAPPER': '/opt/bootstrap',
                'CHAOS_EXTENSION__LAMBDA__ENABLE_LATENCY': 'true',
                'CHAOS_EXTENSION__LAMBDA__LATENCY_VALUE': '10',
                'CHAOS_EXTENSION__LAMBDA__LATENCY_PROBABILITY': '1',
            }
        });

        // ------------------- SNS TOPIC --------------------------------------

        const snsTopic = new sns.Topic(this, 'alarmTopicDemo3', {
            topicName: `${this.stackName}-AlarmTopic`,
            displayName: 'Topic for general alerting and rollback functionality'
        });

        // ------------------- CLOUDWATCH ALARM -------------------------------

        const functionThrottles = chaosLambdaFunction.metricErrors({
            period: Duration.minutes(1),
        });

        const alarm = new cloudwatch.Alarm(this, 'cloudWatchAlarmDemo3', {
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

        // -------------------- FIS Experiment -------------------------------

        // TODO



    }
}

