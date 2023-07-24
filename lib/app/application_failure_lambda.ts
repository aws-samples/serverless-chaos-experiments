import {Duration, Stack, StackProps} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import {ApplicationBase} from "./application_base";

export interface ApplicationFailureLambdaProps extends StackProps {
    applicationName: string;
}

export class ApplicationFailureLambda extends Stack {
    constructor(scope: Construct, id: string, props: ApplicationFailureLambdaProps) {
        super(scope, id, props);

        const chaosParameterName = 'failureLambdaConfig'
        const chaosExperimentConfiguration = '{ "delay": 400, "is_enabled": false, "error_code": 404, "exception_msg": "This is chaos", "rate": 1, "fault_type": "exception"}'

        // ------------------- LAMBDA FUNCTION -------------------------------

        const chaosExperimentFn = new lambda.Function(this, 'chaosLambdaExperiment', {
            handler: 'lambda_function.lambda_handler',
            functionName: 'Lambda_with_Failure_Lambda',
            description: 'Performs simple chaos experiments using the failure_lambda library',
            code: lambda.Code.fromAsset('lambda/failure-lambda', {

            }),
            environment: {
                FAILURE_INJECTION_PARAM: chaosParameterName,
            },
            runtime: lambda.Runtime.NODEJS_18_X,
            timeout: Duration.seconds(25),
            tracing: lambda.Tracing.ACTIVE
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
    }
}
