import {Stack, StackProps} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {ApplicationChaosLambda} from "./app/application_chaos_lambda";
import {ApplicationFailureLambda} from "./app/application_failure_lambda";

export class ServerlessChaosStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        new ApplicationChaosLambda(this, 'ApplicationChaosLambda', {
            applicationName: 'chaosLambda'
        });
        new ApplicationFailureLambda(this, 'ApplicationFailureLambda', {
            applicationName: 'failureLambda'
        });
    }
}
