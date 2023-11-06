import { Duration, Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as pythonLambda from "@aws-cdk/aws-lambda-python-alpha";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import { FisHandlerReplacementExperiment } from "./fis/fis-handler-replacement-experiment";
import { NagSuppressions } from "cdk-nag";


export class DemoTwo extends Stack {
    constructor(scope: Construct, id: string) {
        super(scope, id);

        // ------------------- LAMBDA FUNCTION -------------------------------

        const chaosLambdaFunction = new lambda.Function(this, "chaosLambdaDemo2", {
            handler: "lambda_function.lambda_handler",
            functionName: `${this.stackName}-Func`,
            description: "Simple hello_world lambda function that will be used in chaos experiments",
            code: lambda.Code.fromAsset("lib/resources/lambda/hello_world", {}),
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

        const ssmPermissionsPolicy = new iam.Policy(this, "additional-ssm-policy", {statements: [ssmPermissions]});
        chaosLambdaFunction.role?.attachInlinePolicy(ssmPermissionsPolicy);

        NagSuppressions.addResourceSuppressions(ssmPermissionsPolicy, [
                {
                    id: "AwsSolutions-IAM5",
                    reason: "Reading and writing any parameters needed to run the experiment is permissive.",
                    appliesTo: [
                        {
                            regex: "/(.*)(ChaosInjection)(.*)$/g",
                        },
                    ],
                },
            ],
            true
        );

        NagSuppressions.addResourceSuppressions(chaosLambdaFunction, [
                {
                    id: "AwsSolutions-IAM4",
                    reason: "As this a demo sample using AWS Managed Policies for the Lambda execution role is permissive.",
                    appliesTo: [
                        {
                            regex: "/(.*)(AWSLambdaBasicExecutionRole|service-role)(.*)$/g",
                        },
                    ],
                },
                {
                    id: "AwsSolutions-IAM5",
                    reason: "The AWS Managed policy contains wildcard permissions which is permissive for a sample demo.",
                    appliesTo: ["Resource::*"]
                },
            ],
            true
        );


        // ------------------- CLOUDWATCH ALARM ------------------------------

        // TODO create composite alarm, duration of Lambda func, exceptions, status_code
        const functionThrottles = chaosLambdaFunction.metricErrors({
            period: Duration.minutes(1),
        });

        const alarm = new cloudwatch.Alarm(this, "cloudWatchAlarmDemo2", {
            alarmName: `${this.stackName}-CloudWatchAlarm`,
            alarmDescription: "Checks if we have too many function errors for the test function.",

            metric: functionThrottles,
            threshold: 10,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            evaluationPeriods: 1,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,

            actionsEnabled: true
        });

        // -------------------- Parameter Store ------------------------------

        const chaosExperimentConfiguration = "{ \"is_enabled\": false }";

        const chaosParameter = new ssm.StringParameter(this, "chaosConfigSsmParameterDemo2", {
            parameterName: "/ChaosInjection/ChaosConfigSsmParameter",
            stringValue: chaosExperimentConfiguration,
        });

        // -------------------- Chaos Lambda Layer ---------------------------

        const pythonChaosLayer = new pythonLambda.PythonLayerVersion(this, "chaosPythonLambdaLayerDemo2", {
            entry: "lib/resources/layers/pychaos/python/",
            compatibleRuntimes: [lambda.Runtime.PYTHON_3_11],
            layerVersionName: `${this.stackName}-chaosPythonLayer`,
        });

        // -------------------- FIS Experiment -------------------------------

        const fisExperiment = new FisHandlerReplacementExperiment(this, "fisHandlerReplacementExperiment", {
            chaosParameterName: chaosParameter.parameterName,
            lambdaFunctionArn: chaosLambdaFunction.functionArn,
            lambdaName: chaosLambdaFunction.functionName,
            lambdaLayerArn: pythonChaosLayer.layerVersionArn,
            cloudWatchAlarmArn: alarm.alarmArn
        });

    }
}