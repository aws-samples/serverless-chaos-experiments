import { Stack, Duration } from "aws-cdk-lib";
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import { FisLambdaConcurrencyExperiment } from "./fis/fis-concurrency-experiment";


export class DemoOne extends Stack {
    constructor(scope: Construct, id: string) {
        super(scope, id);


        // ------------------- LAMBDA FUNCTION -------------------------------

        const chaosLambdaFunction = new lambda.Function(this, 'chaosLambdaDemo1', {
            handler: 'lambda_function.lambda_handler',
            functionName: `${this.stackName}-Func`,
            description: 'Simple hello_world lambda function that will be used in chaos experiments',
            code: lambda.Code.fromAsset('lib/resources/lambda/hello_world', {}),
            runtime: lambda.Runtime.PYTHON_3_11,
            tracing: lambda.Tracing.ACTIVE
        });

        // ------------------- SNS TOPIC --------------------------------------

        const snsTopic = new sns.Topic(this, 'alarmTopicDemo1', {
            topicName: `${this.stackName}-AlarmTopic`,
            displayName: 'Topic for general alerting and rollback functionality'
        });

        // ------------------- CLOUDWATCH ALARM -------------------------------

        const functionThrottles = chaosLambdaFunction.metricThrottles({
            period: Duration.minutes(1),
        });

        const alarm = new cloudwatch.Alarm(this, 'cloudWatchAlarmDemo1', {
            alarmName: `${this.stackName}-CloudWatchAlarm`,
            alarmDescription: 'Checks if we have too many throttled function invocations for the test function.',

            metric: functionThrottles,
            threshold: 10,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            evaluationPeriods: 1,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,

            actionsEnabled: true
        });

        alarm.addAlarmAction(new cloudwatchActions.SnsAction(snsTopic));


        // -------------------- FIS Experiment -------------------------------

        new FisLambdaConcurrencyExperiment(this, 'fisLambdaConcurrencyExperimentDemo1', {
            lambdaFunction: chaosLambdaFunction,
            cloudWatchAlarmArn: alarm.alarmArn
        });
    }
}