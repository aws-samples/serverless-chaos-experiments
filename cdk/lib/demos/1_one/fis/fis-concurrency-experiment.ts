import { Construct } from "constructs";
import { aws_fis as fis, aws_iam as iam, aws_ssm as ssm } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib/core";
import { FisRole } from "../../../shared/fis-role";
import * as lambdaNode from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import fs = require("fs");
import path = require("path");
import yaml = require("js-yaml");
import { NagSuppressions } from "cdk-nag";

export interface FisStackProps {
    lambdaFunction: lambdaNode.NodejsFunction;
    cloudWatchAlarmArn: string
}

export class FisLambdaConcurrencyExperiment extends Construct {
    constructor(scope: Construct, id: string, props: FisStackProps) {
        super(scope, id);

        const region = cdk.Stack.of(this).region;
        const accountId = cdk.Stack.of(this).account;

        // -------------------- SSM Document -------------------------------
        const automationDocName = "LambdaConcurrency-FIS-Automation-Doc";

        const documentFile = path.join(__dirname, "documents/ssm-document-put-concurrency.yml");
        const parameterstore_content = fs.readFileSync(documentFile, "utf8");

        const parameterstore_cfnDocument = new ssm.CfnDocument(this, automationDocName, {
                content: yaml.load(parameterstore_content),
                documentType: "Automation",
                documentFormat: "YAML",
                name: automationDocName
            }
        );

        const documentArn = `arn:aws:ssm:${region}:${accountId}:document/${parameterstore_cfnDocument.name}`;

        // -------------------- SSM Role (used during automation execution) -------------------------------

        const ssmaPutConcurrencyStoreRole = new iam.Role(this, "ssma-put-concurrency-role", {
                roleName: "ssmaPutConcurrencyRole",
                assumedBy: new iam.CompositePrincipal(
                    new iam.ServicePrincipal("iam.amazonaws.com"),
                    new iam.ServicePrincipal("ssm.amazonaws.com")
                ),
            }
        );

        const ssmaPutConcurrencyStoreRoleAsCfn = ssmaPutConcurrencyStoreRole.node.defaultChild as iam.CfnRole;
        ssmaPutConcurrencyStoreRoleAsCfn.addOverride(
            "Properties.AssumeRolePolicyDocument.Statement.0.Principal.Service",
            ["ssm.amazonaws.com", "iam.amazonaws.com"]
        );

        ssmaPutConcurrencyStoreRole.addToPolicy(
            new iam.PolicyStatement({
                resources: [
                    props.lambdaFunction.functionArn,
                ],
                actions: [
                    "lambda:PutFunctionConcurrency",
                    "lambda:DeleteFunctionConcurrency"
                ],
            })
        );

        ssmaPutConcurrencyStoreRole.addToPolicy(
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

        NagSuppressions.addResourceSuppressions(ssmaPutConcurrencyStoreRole, [
                {
                    id: "AwsSolutions-IAM5",
                    reason: "Very permissive policy to log to CloudWatch logs for the assumed role is allowed as it is a sample demo.",
                    appliesTo: ["Resource::*"]
                },
            ],
            true
        );

        // -------------------- FIS Log Group -------------------------------

        const fisLogGroup = new LogGroup(this, "fis-log-group-demo-1", {
            logGroupName: "/aws/fis/experiment/demo1",
            retention: RetentionDays.ONE_WEEK,
            removalPolicy: cdk.RemovalPolicy.DESTROY
        });

        // -------------------- FIS Automation Role -------------------------------

        const fisRole = new FisRole(this, "fis-demo1-role", {
            automationDocumentName: automationDocName,
            fisRoleName: "fis-demo1-role",
            automationAssumedRoleArn: ssmaPutConcurrencyStoreRole.roleArn,
            fisLogGroupArn: fisLogGroup.logGroupArn
        });

        // -------------------- FIS Experiment Template -------------------------------

        const startAutomation = {
            actionId: "aws:ssm:start-automation-execution",
            description: "Update SSM parameter used to inject chaos into Lambda function.",
            parameters: {
                documentArn: documentArn,
                documentParameters: JSON.stringify({
                    DurationMinutes: "PT5M",
                    AutomationAssumeRole: ssmaPutConcurrencyStoreRole.roleArn,
                    FunctionName: props.lambdaFunction.functionName,
                    ConcurrencyLevel: 10
                }),
                maxDuration: "PT10M",
            },
        };

        new fis.CfnExperimentTemplate(
            this,
            "fis-template-lambda-concurrency",
            {
                description: "Sets the concurrency level on a Lambda function.",
                roleArn: fisRole.fisRole.roleArn,
                tags: {
                    Name: "Set Lambda concurrency level",
                },
                actions: {
                    ssmaAction: startAutomation,
                },
                stopConditions: [
                    {
                        source: "aws:cloudwatch:alarm",
                        value: props.cloudWatchAlarmArn,
                    },
                ],
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