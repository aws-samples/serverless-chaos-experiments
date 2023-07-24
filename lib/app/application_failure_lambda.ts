import {Duration, Stack, StackProps} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import {ApplicationBase} from "./application_base";
import * as lambdaNode from "aws-cdk-lib/aws-lambda-nodejs";

export interface ApplicationFailureLambdaProps extends StackProps {
    applicationName: string;
}

export class ApplicationFailureLambda extends Stack {
    constructor(scope: Construct, id: string, props: ApplicationFailureLambdaProps) {
        super(scope, id, props);

        const chaosParameterName = 'failureLambdaConfig'
        const chaosExperimentConfiguration = '{"isEnabled": false, "failureMode": "latency", "rate": 0.5, "minLatency": 3000, "maxLatency": 5000}'

        // ------------------- LAMBDA FUNCTION -------------------------------

        // const chaosExperimentFn = new lambda.Function(this, 'chaosLambdaExperiment', {
        //     handler: 'lambda_function.lambda_handler',
        //     functionName: 'Lambda_with_Failure_Lambda',
        //     description: 'Performs simple chaos experiments using the failure_lambda library',
        //     code: lambda.Code.fromAsset('lib/app/resources/lambda/failure-lambda', {
        //
        //     }),
        //     environment: {
        //         FAILURE_INJECTION_PARAM: chaosParameterName,
        //     },
        //     runtime: lambda.Runtime.NODEJS_18_X,
        //     timeout: Duration.seconds(25),
        //     tracing: lambda.Tracing.ACTIVE
        // });

        const chaosExperimentFn = new lambdaNode.NodejsFunction(this, "failureLambdaFunction", {
                runtime: lambda.Runtime.NODEJS_18_X,
                handler: 'handler',
                entry: `${__dirname}/resources/lambda/failure-lambda/lambda_function.js`,
                environment: {
                    FAILURE_INJECTION_PARAM: chaosParameterName,
                },
            bundling: {
                externalModules: [
                    'aws-sdk', // Use the 'aws-sdk' available in the Lambda runtime
                ],
            },
            }
        );

        new ApplicationBase(
            this,
            'ApplicationWithFailureLambda',
            {
                chaosExperimentFn: chaosExperimentFn,
                chaosParameterName: chaosParameterName,
                chaosExperimentConfiguration: chaosExperimentConfiguration,
                applicationName: props.applicationName
            });
    }
}
