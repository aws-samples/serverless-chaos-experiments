#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DemoOne } from '../lib/demos/1_one/demo_one';
import { DemoTwo } from '../lib/demos/2_two/demo_two';
import { DemoThree } from '../lib/demos/3_three/demo_three';
import { AwsSolutionsChecks } from 'cdk-nag'
import { Aspects } from 'aws-cdk-lib';

const app = new cdk.App();
Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }))

new DemoOne(app, 'ServerlessChaos-Demo-1');
new DemoTwo(app, 'ServerlessChaos-Demo-2');
new DemoThree(app, 'ServerlessChaos-Demo-3');
