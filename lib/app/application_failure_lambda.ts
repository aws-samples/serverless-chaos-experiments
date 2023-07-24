import {Duration, Stack, StackProps} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import {ApplicationBase} from "./application_base";
import * as lambdaNode from "aws-cdk-lib/aws-lambda-nodejs";
import {FisLambdaExperiments} from "../fis/fis-experiments";

export interface ApplicationFailureLambdaProps extends StackProps {
    applicationName: string;
}

export class ApplicationFailureLambda extends Stack {
    constructor(scope: Construct, id: string, props: ApplicationFailureLambdaProps) {
        super(scope, id, props);

        const chaosParameterName = 'failureLambdaConfig'
        const chaosExperimentConfiguration = '{"isEnabled": false, "failureMode": "exception", "rate": 1, "minLatency": 100, "maxLatency": 400, "exceptionMsg": "Exception message!", "statusCode": 404, "diskSpace": 100, "denylist": ["s3.*.amazonaws.com", "dynamodb.*.amazonaws.com"]}';

        // ------------------- LAMBDA FUNCTION -------------------------------q

        const chaosExperimentFn = new lambdaNode.NodejsFunction(
            this,
            'failureLambdaFunction', {
                functionName: 'Lambda_with_Failure_Lambda',
                entry: `${__dirname}/resources/lambda/failure-lambda/index.js`,
                description: 'Performs simple chaos experiments using the failure_lambda library',
                timeout: Duration.seconds(25),
                tracing: lambda.Tracing.ACTIVE,
                environment: {
                    FAILURE_INJECTION_PARAM: chaosParameterName,
                },
        });

        new ApplicationBase(
            this,
            'ApplicationWithFailureLambda',
            {
                chaosExperimentFn: chaosExperimentFn,
                chaosParameterName: chaosParameterName,
                chaosExperimentConfiguration: chaosExperimentConfiguration,
                applicationName: props.applicationName
            });

        // ------------------- FIS Experiments -------------------------------

        new FisLambdaExperiments(
            this,
            'FisLambdaExperimentFailureLambda',
            {
                lambdaFunction: chaosExperimentFn,
                chaosParameterName: chaosParameterName
            });
    }
}
