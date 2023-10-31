import { Stack, Duration } from "aws-cdk-lib";
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { FisChaosExtensionProxyExperiment } from "./fis/fis-chaos-extension-experiment";


export class DemoThree extends Stack {
    constructor(scope: Construct, id: string) {
        super(scope, id);

        // ------------------- CHAOS LAMBDA LAYER -------------------------------

        // Check latest version here: https://github.com/aws-cli-tools/chaos-lambda-extension/blob/main/LAYERS.md
        // Leave account number as the Layers are hosted there
        // If you're using ARM, use a different layer ARN
        const chaosLayerVersion = 9;
        const chaosLayerArn = `arn:aws:lambda:${this.region}:871265522301:layer:chaos-lambda-extension-x86_64-unknown-linux-gnu-release:${chaosLayerVersion}`;

        // ------------------- LAMBDA FUNCTION -------------------------------

        const chaosLambdaFunction = new lambda.Function(this, 'chaosLambdaDemo3', {
            handler: 'lambda_function.lambda_handler',
            functionName: `${this.stackName}-Func`,
            description: 'Simple hello_world lambda function that will be used in chaos experiments',
            code: lambda.Code.fromAsset('lib/resources/lambda/hello_world', {}),
            runtime: lambda.Runtime.PYTHON_3_11,
            tracing: lambda.Tracing.ACTIVE,
            timeout: Duration.seconds(30)
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

        // -------------------- FIS Experiment -------------------------------

        const fisExperiment = new FisChaosExtensionProxyExperiment(this, 'fisHandlerReplacementExperiment', {
            lambdaFunctionArn: chaosLambdaFunction.functionArn,
            lambdaName: chaosLambdaFunction.functionName,
            lambdaLayerArn: chaosLayerArn,
            chaosType: "response",
            chaosLatency: "10",
            chaosProbability: "1",
            chaosResponse: '{"statusCode": 500, "body": "hello, Chaos!!!"}',
            cloudWatchAlarmArn: alarm.alarmArn
        });
    }
}

