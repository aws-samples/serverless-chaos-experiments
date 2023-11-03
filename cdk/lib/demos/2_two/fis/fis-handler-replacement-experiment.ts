import { Construct } from "constructs";
import { aws_fis as fis, aws_iam as iam, aws_ssm as ssm } from "aws-cdk-lib";
import * as cdk from 'aws-cdk-lib/core';
import { FisRoleDemo2 } from "./fis-role";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import fs = require("fs");
import path = require("path");
import yaml = require("js-yaml");


export interface FisStackProps {
    lambdaFunctionArn: string;
    lambdaName: string;
    lambdaLayerArn: string;
    chaosParameterName: string;
    cloudWatchAlarmArn: string;
}

export class FisHandlerReplacementExperiment extends Construct {
    constructor(scope: Construct, id: string, props: FisStackProps) {
        super(scope, id);

        const region = cdk.Stack.of(this).region;
        const accountId = cdk.Stack.of(this).account;


        // -------------------- SSM Document -------------------------------

        const documentFile = path.join(__dirname, "documents/ssm-document-handler-replacement.yml");
        const parameterstore_content = fs.readFileSync(documentFile, "utf8");

        const parameterstore_cfnDocument = new ssm.CfnDocument(this, 'HandlerReplacement-FIS-Automation-Doc', {
            content: yaml.load(parameterstore_content),
            documentType: "Automation",
            documentFormat: "YAML",
            name: 'HandlerReplacement-FIS-Automation-Doc'
        }
        );

        // -------------------- SSM Role (used during automation execution) -------------------------------

        const ssmaHandlerReplacementRole = new iam.Role(this, "ssma-put-parameterstore-role", {
                roleName: 'ssmaHandlerReplacementRole',
                assumedBy: new iam.CompositePrincipal(
                    new iam.ServicePrincipal("iam.amazonaws.com"),
                    new iam.ServicePrincipal("ssm.amazonaws.com")
                ),
        }
        );

        const ssmaHandlerReplacmentStoreRoleAsCfn = ssmaHandlerReplacementRole.node.defaultChild as iam.CfnRole;
        ssmaHandlerReplacmentStoreRoleAsCfn.addOverride(
            "Properties.AssumeRolePolicyDocument.Statement.0.Principal.Service",
            ["ssm.amazonaws.com", "iam.amazonaws.com"]
        );

        // allow the SSM document to get & put the chaos config & the handler info parameters to the Parameter Store
        ssmaHandlerReplacementRole.addToPolicy(
            new iam.PolicyStatement({
                resources: [
                    `arn:aws:ssm:${region}:${accountId}:parameter/ChaosInjection/*`,
                ],
                actions: [
                    "ssm:PutParameter",
                    "ssm:LabelParameterVersion",
                    "ssm:DescribeDocumentParameters",
                    "ssm:GetParameters",
                    "ssm:GetParameter",
                    "ssm:DescribeParameters",
                ],
            })
        );

        ssmaHandlerReplacementRole.addToPolicy(
            new iam.PolicyStatement({
                resources: [ props.lambdaFunctionArn ],
                actions: [ 
                    "lambda:UpdateFunctionConfiguration",
                    "lambda:GetFunctionConfiguration",
                    "lambda:GetFunction"
                ],
            })
        );

        ssmaHandlerReplacementRole.addToPolicy(
            new iam.PolicyStatement({
                resources: [ props.lambdaLayerArn ],
                actions: [ "lambda:GetLayerVersion" ],
            })
        );

        // allow the SSM document to log to CloudWatch
        ssmaHandlerReplacementRole.addToPolicy(
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
            description: "Update SSM parameters and replace handler with Chaos Lambda Layer to inject chaos into Lambda function.",
            parameters: {
                documentArn: `arn:aws:ssm:${region}:${accountId}:document/${parameterstore_cfnDocument.name}`,
                documentParameters: JSON.stringify({
                    FunctionName: props.lambdaName,
                    ChaosLayerArn: props.lambdaLayerArn,
                    DurationMinutes: "PT5M",
                    AutomationAssumeRole: ssmaHandlerReplacementRole.roleArn,
                    ChaosParameterName: props.chaosParameterName,
                    ChaosParameterValue: '{ "fault_type": "exception", "is_enabled": false, "delay": 400, "error_code": 404, "exception_msg": "This is chaos", "rate": 1}',
                }),
                maxDuration: "PT10M",
            },
        };

        // -------------------- FIS Automation Role -------------------------------

        const fisRole = new FisRoleDemo2(this, 'fis-role-demo2');

        // -------------------- FIS Log Group -------------------------------

        const fisLogGroup = new LogGroup(this, 'fis-log-group-demo-2', {
            logGroupName: '/aws/fis/experiment/demo2',
            retention: RetentionDays.ONE_WEEK,
            removalPolicy: cdk.RemovalPolicy.DESTROY
        });
   
        // -------------------- FIS Experiment Template -------------------------------

        new fis.CfnExperimentTemplate(
            this,
            "fis-template-replace_handler",
            {
                description: "Inject faults into Lambda function using chaos-lambda and handler replacement library",
                roleArn: fisRole.fisRole.roleArn,
                stopConditions: [
                    {
                        source: "aws:cloudwatch:alarm",
                        value: props.cloudWatchAlarmArn,
                    },
                ],
                tags: {
                    Name: "Lambda Handler Replacement",
                },
                actions: {
                    ssmaAction: startAutomation,
                },
                logConfiguration: {
                    cloudWatchLogsConfiguration: {
                        LogGroupArn: fisLogGroup.logGroupArn,
                    },
                    logSchemaVersion: 2
                },
                targets: {},
            }
        );
    }
}