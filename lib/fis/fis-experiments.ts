import {Construct} from "constructs";
import {aws_ssm as ssm} from "aws-cdk-lib";
import {aws_iam as iam} from "aws-cdk-lib";
import {aws_fis as fis} from "aws-cdk-lib";
import * as cdk from 'aws-cdk-lib/core';

import fs = require("fs");
import path = require("path");
import yaml = require("js-yaml");
import {FisRole} from "./fis-role";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import {ComparisonOperator, TreatMissingData} from "aws-cdk-lib/aws-cloudwatch";
import * as lambdaNode from "aws-cdk-lib/aws-lambda-nodejs";

export interface FisStackProps {
    lambdaFunction: lambdaNode.NodejsFunction;
    chaosParameterName: string;
}

export class FisLambdaExperiments extends Construct {
    constructor(scope: Construct, id: string, props: FisStackProps) {
        super(scope, id);

        const region = cdk.Aws.REGION;
        const accountId = cdk.Aws.ACCOUNT_ID;

        const errorMetric = props.lambdaFunction.metricErrors();

        const alarm = new cloudwatch.Alarm(
            this,
            'fisStopCondition',
            {
                alarmName: 'fisStopCondition',
                alarmDescription: 'Checks if the Lambda function is affected by the chaos experiment.',
                metric: errorMetric,
                threshold: 10,
                comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
                evaluationPeriods: 1,
                treatMissingData: TreatMissingData.NOT_BREACHING,
                actionsEnabled: true
            });

        // Deploy the SSMA document to modify a parameter store value
        const documentFile = path.join(__dirname, "documents/ssm-document-put-config-parameterstore.yml");

        const parameterstore_content = fs.readFileSync(documentFile, "utf8");

        const parameterstore_cfnDocument = new ssm.CfnDocument(
            this,
            `ParameterStore-SSM-Document`,
            {
                content: yaml.load(parameterstore_content),
                documentType: "Automation",
                documentFormat: "YAML",
                name: 'ParameterStore-FIS-Automation'
            }
        );

        const ssmaPutParameterStoreRole = new iam.Role(
            this,
            "ssma-put-parameterstore-role",
            {
                roleName: 'ssmaPutParameterRole',
                assumedBy: new iam.CompositePrincipal(
                    new iam.ServicePrincipal("iam.amazonaws.com"),
                    new iam.ServicePrincipal("ssm.amazonaws.com")
                ),
            }
        );

        const ssmaPutParameterStoreRoleAsCfn = ssmaPutParameterStoreRole.node
            .defaultChild as iam.CfnRole;
        ssmaPutParameterStoreRoleAsCfn.addOverride(
            "Properties.AssumeRolePolicyDocument.Statement.0.Principal.Service",
            ["ssm.amazonaws.com", "iam.amazonaws.com"]
        );

        ssmaPutParameterStoreRole.addToPolicy(
            new iam.PolicyStatement({
                resources: [
                    `arn:aws:ssm:${region}:${accountId}:parameter/${props.chaosParameterName}`,
                ],
                actions: ["ssm:PutParameter"],
            })
        );

        ssmaPutParameterStoreRole.addToPolicy(
            new iam.PolicyStatement({
                resources: ["*"],
                actions: [
                    "logs:CreateLogStream",
                    "logs:CreateLogGroup",
                    "logs:PutLogEvents",
                    "logs:DescribeLogGroups",
                    "logs:DescribeLogStreams",
                ],
            })
        );

        const startAutomation = {
            actionId: "aws:ssm:start-automation-execution",
            description: "Update SSM parameter used to inject chaos into Lambda function.",
            parameters: {
                documentArn: `arn:aws:ssm:${region}:${accountId}:document/${parameterstore_cfnDocument.name}`,
                documentParameters: JSON.stringify({
                    DurationMinutes: "PT5M",
                    AutomationAssumeRole: ssmaPutParameterStoreRole.roleArn,
                    ParameterName: props.chaosParameterName,
                    ParameterValue: '{"isEnabled": true, "failureMode": "exception", "rate": 1, "minLatency": 100, "maxLatency": 400, "exceptionMsg": "Exception message!", "statusCode": 404, "diskSpace": 100, "denylist": ["s3.*.amazonaws.com", "dynamodb.*.amazonaws.com"]}',
                    RollbackValue: '{"isEnabled": false, "failureMode": "exception", "rate": 1, "minLatency": 100, "maxLatency": 400, "exceptionMsg": "Exception message!", "statusCode": 404, "diskSpace": 100, "denylist": ["s3.*.amazonaws.com", "dynamodb.*.amazonaws.com"]}'
                }),
                maxDuration: "PT10M",
            },
        };

        // FIS role
        const fisRole = new FisRole(this, 'fis-role');

        // Experiments
        new fis.CfnExperimentTemplate(
            this,
            "fis-template-inject-lambda-fault",
            {
                description: "Inject faults into Lambda function using chaos-lambda library",
                roleArn: fisRole.fisRole.roleArn,
                stopConditions: [
                    {
                        source: "aws:cloudwatch:alarm",
                        value: alarm.alarmArn,
                    },
                ],
                tags: {
                    Name: "Inject fault to Lambda functions",
                },
                actions: {
                    ssmaAction: startAutomation,
                },
                targets: {},
            }
        );
    }
}