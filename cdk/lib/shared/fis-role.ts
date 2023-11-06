import { Construct } from "constructs";
import { aws_iam as iam } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib/core";

export interface FisRoleProps {
    fisRoleName: string;
    automationDocumentName: string;
    automationAssumedRoleArn: string,
    fisLogGroupArn: string;
}

export class FisRole extends Construct {

    fisRole: iam.Role;

    constructor(scope: Construct, id: string, props: FisRoleProps) {
        super(scope, id);

        const region = cdk.Aws.REGION;
        const accountId = cdk.Aws.ACCOUNT_ID;


        // ------------------- FIS ROLE -------------------------------

        this.fisRole = new iam.Role(this, props.fisRoleName, {
            roleName: props.fisRoleName,
            assumedBy: new iam.ServicePrincipal("fis.amazonaws.com", {
                conditions: {
                    StringEquals: {
                        "aws:SourceAccount": accountId,
                    },
                    ArnLike: {
                        "aws:SourceArn": `arn:aws:fis:${region}:${accountId}:experiment/*`,
                    },
                },
            }),
        });

        //AllowFISExperimentRoleSSMAAction
        this.fisRole.addToPolicy(
            new iam.PolicyStatement({
                resources: [`arn:aws:ssm:${region}:${accountId}:automation-definition/${props.automationDocumentName}:$DEFAULT`],
                actions: ["ssm:StartAutomationExecution", "ssm:StopAutomationExecution", "ssm:GetAutomationExecution"],
            })
        );
        this.fisRole.addToPolicy(
            new iam.PolicyStatement({
                resources: [`arn:aws:ssm:${region}:${accountId}:automation-execution/*`],
                actions: ["ssm:StopAutomationExecution", "ssm:GetAutomationExecution"],
            })
        );

        //AllowFISExperimentRoleSSMAutomationPassRole
        this.fisRole.addToPolicy(
            new iam.PolicyStatement({
                resources: [props.automationAssumedRoleArn],
                actions: ["iam:PassRole"],
                conditions:
                    {
                        "StringEquals": {
                            "iam:PassedToService": "ssm.amazonaws.com"
                        }
                    }
            })
        );

        //AllowLogsRoleAllLogDelivery
        // See https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/AWS-logs-and-resource-policy.html#AWS-logs-infrastructure-CWL
        this.fisRole.addToPolicy(
            new iam.PolicyStatement({
                resources: ["*"],
                actions: ["logs:CreateLogDelivery"],
            })
        );

        // Enable logging to CloudWatch Logs
        // See https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/AWS-logs-and-resource-policy.html#AWS-logs-infrastructure-CWL
        this.fisRole.addToPolicy(
            new iam.PolicyStatement({
                resources: [props.fisLogGroupArn],
                actions: [
                    "logs:PutResourcePolicy",
                    "logs:DescribeResourcePolicies",
                    "logs:DescribeLogGroups",
                ],
            })
        );
    }
}
