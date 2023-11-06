import { Construct } from "constructs";
import { aws_fis as fis, aws_iam as iam, aws_ssm as ssm } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib/core";
import { FisRole } from "../../../shared/fis-role";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import fs = require("fs");
import path = require("path");
import yaml = require("js-yaml");


export interface FisStackProps {
    lambdaFunctionArn: string;
    lambdaName: string;
    lambdaLayerArn: string;
    chaosType: string;
    chaosLatency: string;
    chaosResponse: string;
    chaosProbability: string;
    cloudWatchAlarmArn: string;
}

export class FisChaosExtensionProxyExperiment extends Construct {
    constructor(scope: Construct, id: string, props: FisStackProps) {
        super(scope, id);

        const region = cdk.Stack.of(this).region;
        const accountId = cdk.Stack.of(this).account;


        // -------------------- SSM Document -------------------------------
        const automationDocName = "ChaosExtensionProxy-FIS-Automation-Doc";

        const documentFile = path.join(__dirname, "documents/ssm-document-configure-chaos-extension.yml");
        const fileContent = fs.readFileSync(documentFile, "utf8");

        const chaosExtensionProxy_cfnDocument = new ssm.CfnDocument(this, automationDocName, {
                content: yaml.load(fileContent),
                documentType: "Automation",
                documentFormat: "YAML",
                name: automationDocName
            }
        );

        // -------------------- SSM Role (used during automation execution) -------------------------------

        const ssmaChaosExtensionProxyRole = new iam.Role(this, "ssma-ChaosExtensionProxy-role", {
                roleName: "ssmaChaosExtensionProxyRole",
                assumedBy: new iam.CompositePrincipal(
                    new iam.ServicePrincipal("iam.amazonaws.com"),
                    new iam.ServicePrincipal("ssm.amazonaws.com")
                ),
            }
        );

        const ssmaChaosExtensionProxyAsCfn = ssmaChaosExtensionProxyRole.node.defaultChild as iam.CfnRole;
        ssmaChaosExtensionProxyAsCfn.addOverride(
            "Properties.AssumeRolePolicyDocument.Statement.0.Principal.Service",
            ["ssm.amazonaws.com", "iam.amazonaws.com"]
        );

        // allow the SSM document to get and update the Lambda configuration
        ssmaChaosExtensionProxyRole.addToPolicy(
            new iam.PolicyStatement({
                resources: [props.lambdaFunctionArn],
                actions: [
                    "lambda:UpdateFunctionConfiguration",
                    "lambda:GetFunctionConfiguration"
                ],
            })
        );

        // allow the SSM document to get the Lambda Layer version when calling the UpdateFunction API
        ssmaChaosExtensionProxyRole.addToPolicy(
            new iam.PolicyStatement({
                resources: [props.lambdaLayerArn],
                actions: ["lambda:GetLayerVersion"],
            })
        );

        // allow the SSM document to log to CloudWatch
        ssmaChaosExtensionProxyRole.addToPolicy(
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
            description: "Add chaos extension layer and update environment variables to start the chaos experiment.",
            parameters: {
                documentArn: `arn:aws:ssm:${region}:${accountId}:document/${chaosExtensionProxy_cfnDocument.name}`,
                documentParameters: JSON.stringify({
                    FunctionName: props.lambdaName,
                    ChaosLayerArn: props.lambdaLayerArn,
                    ChaosType: props.chaosType,
                    ChaosLatency: props.chaosLatency,
                    ChaosResponse: props.chaosResponse,
                    ChaosProbability: props.chaosProbability,
                    DurationMinutes: "PT5M",
                    AutomationAssumeRole: ssmaChaosExtensionProxyRole.roleArn,
                }),
                maxDuration: "PT10M",
            },
        };

        // -------------------- FIS Log Group -------------------------------

        const fisLogGroup = new LogGroup(this, "fis-log-group-demo-3", {
            logGroupName: "/aws/fis/experiment/demo3",
            retention: RetentionDays.ONE_WEEK,
            removalPolicy: cdk.RemovalPolicy.DESTROY
        });

        // -------------------- FIS Automation Role -------------------------------

        const fisRole = new FisRole(this, "fis-demo3-role", {
            automationDocumentName: automationDocName,
            fisRoleName: "fis-demo3-role",
            automationAssumedRoleArn: ssmaChaosExtensionProxyRole.roleArn,
            fisLogGroupArn: fisLogGroup.logGroupArn
        });


        // -------------------- FIS Experiment Template -------------------------------

        new fis.CfnExperimentTemplate(
            this,
            "fis-template-chaos-extension-proxy",
            {
                description: "Inject faults into Lambda function using the extension proxy pattern.",
                roleArn: fisRole.fisRole.roleArn,
                stopConditions: [
                    {
                        source: "aws:cloudwatch:alarm",
                        value: props.cloudWatchAlarmArn,
                    },
                ],
                tags: {
                    Name: "Chaos Extension Proxy Experiment",
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