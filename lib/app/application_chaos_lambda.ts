import {Duration, Stack, StackProps, CfnOutput} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import {ApplicationBase} from "./application_base";

export interface ApplicationChaosLambdaProps extends StackProps {
    applicationName: string;
}

export class ApplicationChaosLambda extends Stack {
    constructor(scope: Construct, id: string, props: ApplicationChaosLambdaProps) {
        super(scope, id, props);

        const chaosParameterName = 'chaoslambda.config'
        const chaosExperimentConfiguration = '{ "fault_type": "exception", "is_enabled": false, "delay": 400, "error_code": 404, "exception_msg": "This is chaos", "rate": 1}'

        // ------------------- LAMBDA FUNCTION -------------------------------

        const chaosExperimentFn = new lambda.Function(this, 'chaosLambdaExperiment', {
            handler: 'lambda_function.lambda_handler',
            functionName: 'Lambda_with_Chaos_Lambda',
            description: 'Performs simple chaos experiments using the chaos_lambda library',
            code: lambda.Code.fromAsset('lib/app/resources/lambda/chaos_lambda', {
                bundling: {
                    image: lambda.Runtime.PYTHON_3_10.bundlingImage,
                    command: [
                        'bash', '-c',
                        'pip install -r requirements.txt -t /asset-output && cp -au . /asset-output'
                    ],
                },
            }),
            runtime: lambda.Runtime.PYTHON_3_10,
            timeout: Duration.seconds(25),
            tracing: lambda.Tracing.ACTIVE
        });

        new ApplicationBase(
            this,
            'ApplicationWithChaosLambda',
            {
                chaosExperimentFn: chaosExperimentFn,
                chaosParameterName: chaosParameterName,
                chaosExperimentConfiguration: chaosExperimentConfiguration,
                applicationName: props.applicationName
            });

        new CfnOutput(this,
            'chaosLambdaAppFuncName',
            {
                value: chaosExperimentFn.functionName,
                description: 'The name of the Lambda function with chaos_lambda added.',
                exportName: 'chaosLambdaAppFuncName',
        });
    }
}
