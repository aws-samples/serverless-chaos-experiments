import { Construct } from "constructs";
import { aws_iam as iam } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib/core";

export class FisRoleDemo3 extends Construct {

    fisRole: iam.Role;

    constructor(scope: Construct, id: string) {
        super(scope, id);

        const region = cdk.Aws.REGION;
        const accountId = cdk.Aws.ACCOUNT_ID;

        
        // FIS Role
        this.fisRole = new iam.Role(this, "fis-role-demo3", {
            roleName: 'fisChaosLambdaRoleDemo3',
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
                resources: [`*`],
                actions: ["ssm:StartAutomationExecution", "ssm:StopAutomationExecution", "ssm:GetAutomationExecution"],
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
