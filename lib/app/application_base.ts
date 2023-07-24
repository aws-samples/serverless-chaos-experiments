import {CfnOutput, Duration, Stack} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNode from "aws-cdk-lib/aws-lambda-nodejs";
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import {ComparisonOperator, TreatMissingData} from 'aws-cdk-lib/aws-cloudwatch';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';

export interface ApplicationProps {
    chaosExperimentFn: lambda.Function | lambdaNode.NodejsFunction;
    chaosExperimentConfiguration: string;
    chaosParameterName: string;
    applicationName: string;
}

export class ApplicationBase extends Construct {

    constructor(scope: Construct, id: string, props: ApplicationProps) {
        super(scope, id);

        // ------------------- SQS QUEUE -------------------------------

        const queue = new sqs.Queue(
            this,
            `${props.applicationName}-TriggerQueue`,
            {
                queueName: `${props.applicationName}-TriggerQueue`
        });

        const eventSource = new lambdaEventSources.SqsEventSource(queue);
        props.chaosExperimentFn.addEventSource(eventSource);

        // ------------------- SSM CHAOS CONFIG PARAMETER -------------------------------

        new ssm.StringParameter(
            this,
            `${props.applicationName}-ConfigSsmParameter`,
            {
                parameterName: props.chaosParameterName,
                stringValue: props.chaosExperimentConfiguration,
        });

        const describeParametersPolicy = new iam.PolicyStatement({
            actions: ['ssm:DescribeParameters'],
            resources: ['*'],
            effect: iam.Effect.ALLOW
        });

        const accessParameterStorePolicy = new iam.PolicyStatement({
            actions: ['ssm:GetParameters', 'ssm:GetParameter'],
            resources: [`arn:aws:ssm:${Stack.of(this).region}:${Stack.of(this).account}:parameter/${props.chaosParameterName}`],
            effect: iam.Effect.ALLOW
        });

        props.chaosExperimentFn.role?.attachInlinePolicy(
            new iam.Policy(
                this,
                `${props.applicationName}-AccessParameterStore`, {
                statements: [describeParametersPolicy, accessParameterStorePolicy]
            })
        );

        // ------------------- SNS TOPIC -------------------------------

        const snsTopic = new sns.Topic(
            this,
            `${props.applicationName}-alaramTopic`, {
            topicName: `${props.applicationName}-alarmTopic`,
            displayName: 'Topic for general alerting functionality'
        });

        // ------------------- CLOUDWATCH ALARM -------------------------------

        const functionThrottles = props.chaosExperimentFn.metricThrottles({
            period: Duration.minutes(1),
        });

        const alarm = new cloudwatch.Alarm(
            this,
            `${props.applicationName}-tooManyFunctionThrottles`,
            {
                alarmName: `${props.applicationName}-tooManyFunctionThrottles`,
                alarmDescription: 'Checks if we have too many throttled function invocations for the test function.',

                metric: functionThrottles,
                threshold: 10,
                comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
                evaluationPeriods: 1,
                treatMissingData: TreatMissingData.NOT_BREACHING,

                actionsEnabled: true
        });

        alarm.addAlarmAction(new cloudwatchActions.SnsAction(snsTopic));

        new CfnOutput(this,
            `${props.applicationName}-sqsUrl`,
            {
                value: queue.queueUrl,
                description: 'The queue URL triggering the respective Lambda function.',
                exportName: `${props.applicationName}-sqsUrl`,
            });

        new CfnOutput(this,
            `${props.applicationName}-outAlarmName`,
            {
                value: alarm.alarmName,
                description: 'The name of the alarm to monitor the Lambda function with chaos_lambda added.',
                exportName: `${props.applicationName}-alarmName`,
            });

        new CfnOutput(this,
            `${props.applicationName}-outAlarmArn`,
            {
                value: alarm.alarmArn,
                description: 'The ARN of the alarm to monitor the Lambda function with chaos_lambda added.',
                exportName: `${props.applicationName}-alarmArn`,
            });

        new CfnOutput(this,
            `${props.applicationName}-configParameter`,
            {
                value: props.chaosParameterName,
                description: 'The name of the SSM parameter to inject chaos.',
                exportName: `${props.applicationName}-chaosConfigParameter`,
            });
    }
}
