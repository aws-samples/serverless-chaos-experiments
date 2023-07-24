import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { StackProps, Stack } from "aws-cdk-lib";
import { aws_iam as iam } from "aws-cdk-lib";

export class FisRole extends Stack {

    fisRole: iam.Role;

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        // FIS Role
        this.fisRole = new iam.Role(this, "fis-role", {
            assumedBy: new iam.ServicePrincipal("fis.amazonaws.com", {
                conditions: {
                    StringEquals: {
                        "aws:SourceAccount": this.account,
                    },
                    ArnLike: {
                        "aws:SourceArn": `arn:aws:fis:${this.region}:${this.account}:experiment/*`,
                    },
                },
            }),
        });

        // AllowFISExperimentRoleCloudWatchActions
        this.fisRole.addToPolicy(
            new iam.PolicyStatement({
                resources: ["*"],
                actions: ["cloudwatch:DescribeAlarms"],
            })
        );

        //AllowFISExperimentRoleSSMReadOnly
        this.fisRole.addToPolicy(
            new iam.PolicyStatement({
                resources: ["*"],
                actions: [
                    "ec2:DescribeInstances",
                    "ssm:ListCommands",
                    "ssm:CancelCommand",
                    "ssm:PutParameter"
                ],
            })
        );

        //AllowFISExperimentRoleSSMAAction
        this.fisRole.addToPolicy(
            new iam.PolicyStatement({
                resources: [`*`],
                actions: ["ssm:StopAutomationExecution", "ssm:GetAutomationExecution"],
            })
        );

        //AllowFISExperimentRoleSSMAAction
        this.fisRole.addToPolicy(
            new iam.PolicyStatement({
                resources: [`*`],
                actions: ["ssm:StartAutomationExecution"],
            })
        );

        //AllowFISExperimentRoleSSMSendCommand
        this.fisRole.addToPolicy(
            new iam.PolicyStatement({
                resources: [`arn:aws:ec2:*:*:instance/*`, `arn:aws:ssm:*:*:document/*`],
                actions: ["ssm:SendCommand"],
            })
        );

        //AllowFISExperimentRoleSSMAutomationPassRole
        this.fisRole.addToPolicy(
            new iam.PolicyStatement({
                resources: [`arn:aws:iam::*:role/*`],
                actions: ["iam:PassRole"],
            })
        );


        //AllowLogsRoleAllLogDelivery
        this.fisRole.addToPolicy(
            new iam.PolicyStatement({
                resources: ["*"],
                actions: ["logs:CreateLogDelivery"],
            })
        );

        //AllowLogsRoleCloudWatch
        this.fisRole.addToPolicy(
            new iam.PolicyStatement({
                resources: ["*"],
                actions: [
                    "logs:PutResourcePolicy",
                    "logs:DescribeResourcePolicies",
                    "logs:DescribeLogGroups",
                ],
            })
        );
    }
}
