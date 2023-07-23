import {Duration, Stack, StackProps} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import {ComparisonOperator, TreatMissingData} from 'aws-cdk-lib/aws-cloudwatch';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';

export class ServerlessChaosStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const chaosParameterName = 'chaoslambda.config'

        // ------------------- LAMBDA FUNCTION -------------------------------

        const chaosExperimentFn = new lambda.Function(this, 'chaosLambdaExperiemnt', {
            handler: 'lambda_function.lambda_handler',
            functionName: `${this.stackName}-chaos-experiment`,
            description: 'Performs simple chaos experiments using the chaos_lambda library',
            code: lambda.Code.fromAsset('lambda/chaos_lambda', {
                bundling: {
                    image: lambda.Runtime.PYTHON_3_10.bundlingImage,
                    command: [
                        'bash', '-c',
                        'pip install -r requirements.txt -t /asset-output && cp -au . /asset-output'
                    ],
                },
            }),
            runtime: lambda.Runtime.PYTHON_3_10,
            timeout: Duration.seconds(25),
            tracing: lambda.Tracing.ACTIVE
        });

        // ------------------- SQS QUEUE -------------------------------

        const queue = new sqs.Queue(this, 'triggerSqsQueue', {
            queueName: 'ChaosLambdaTriggerQueue'
        });

        const eventSource = new lambdaEventSources.SqsEventSource(queue);
        chaosExperimentFn.addEventSource(eventSource);

        // ------------------- SSM CHAOS CONFIG PARAMETER -------------------------------

        const ssmParameter = new ssm.StringParameter(this, 'chaosConfigSsmParameter', {
            parameterName: chaosParameterName,
            stringValue: '{ "delay": 400, "is_enabled": false, "error_code": 404, "exception_msg": "This is chaos", "rate": 1, "fault_type": "exception"}',
        });

        const describeParametersPolicy = new iam.PolicyStatement({
            actions: ['ssm:DescribeParameters'],
            resources: ['*'],
            effect: iam.Effect.ALLOW
        });

        const accessParameterStorePolicy = new iam.PolicyStatement({
            actions: ['ssm:GetParameters', 'ssm:GetParameter'],
            resources: [`arn:aws:ssm:${Stack.of(this).region}:${Stack.of(this).account}:parameter/${chaosParameterName}`],
            effect: iam.Effect.ALLOW
        });

        chaosExperimentFn.role?.attachInlinePolicy(
            new iam.Policy(this, 'access-parameter-store', {
                statements: [describeParametersPolicy, accessParameterStorePolicy]
            })
        );

        // ------------------- SNS TOPIC -------------------------------

        const snsTopic = new sns.Topic(this, 'alarmTopic', {
            topicName: 'AlarmTopic',
            displayName: 'Topic for general alerting functionality'
        });

        // ------------------- CLOUDWATCH ALARM -------------------------------

        const functionThrottles = chaosExperimentFn.metricThrottles({
            period: Duration.minutes(1),
        });

        const alarm = new cloudwatch.Alarm(this, 'tooManyFunctionThrottles', {
            alarmName: 'TooManyLambdaInvocationThrottles',
            alarmDescription: 'Checks if we have too many throttled function invocations for the test function.',

            metric: functionThrottles,
            threshold: 10,
            comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            evaluationPeriods: 1,
            treatMissingData: TreatMissingData.NOT_BREACHING,

            actionsEnabled: true
        });

        alarm.addAlarmAction(new cloudwatchActions.SnsAction(snsTopic));
    }
}
