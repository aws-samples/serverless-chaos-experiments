#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DemoOne } from '../lib/demos/1_one/demo_one';
import { DemoTwo } from '../lib/demos/2_two/demo_two';
import { DemoThree } from '../lib/demos/3_three/demo_three';
import { AwsSolutionsChecks } from 'cdk-nag'
import { Aspects } from 'aws-cdk-lib';

const app = new cdk.App();
// Add the cdk-nag AwsSolutions Pack with extra verbose logging enabled.
Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }))
new DemoOne(app, 'DemoOne');
new DemoTwo(app, 'ServerlessChaos-Demo-2');
new DemoThree(app, 'ServerlessChaos-Demo-3');