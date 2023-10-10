# Serverless Chaos Engineering

This project contains several demos showcasing different approaches for Serverless Chaos Engineering:

* Demo 1: Configuration manipulation
* Demo 2: Handler Replacement Approach
* Demo 3: Runtime API Proxy Pattern using Extensions

## Prerequisites

- Chaos Toolkit (see [here](https://chaostoolkit.org/reference/usage/install/))
- chaostoolkit-aws (see [here](https://chaostoolkit.org/drivers/aws/#install))
- CDK set up

## Deploy

```
npm install
cdk deploy --all
```

Optionally you can deploy the demo stacks individually. The stacks contain all resources to run the demo.
To do this just specify the stack in the deploy command, e.g. `cdk deploy ServerlessChaos-Demo-1`

## Demo 1

This demo showcases how one can manipulate the Lambda configuration. Specifically in this case we will change the concurrency level of the Lambda function. To do this you can either use the

- AWS Fault Injection Simulator, or
- the Chaos Toolkit (WIP)

See below one how to use this tools.

## Demo 2:

![Demo 2: Handler replacement approach](images/demo2.png)

This demo details how to change the handler during the experiment. It leverages the method explained in this blog post.

## Demo 3:

![Demo 3: Runtime API Proxy pattern](images/demo3.png)

Here we make use a Lambda extension in order to inject chaos regardless of the runtime. In this demo will use the preexisting tool [chaos-lambda-extension](https://github.com/aws-cli-tools/chaos-lambda-extension). Running this extension allows you to intercept all calls from the Runtime and the function code to the Runtime API.

## Chaos Tools

In this repository we use the following chaos tools:

- [AWS Fault Injection Simulator (FIS)](https://aws.amazon.com/fis/)
  - AWS tool to improve resiliency and performance with controlled experiments
- [CHAOS Toolkit](https://chaostoolkit.org/)
  - Opensource tool to perform chaos experiments
- [chaos_Lambda](https://github.com/adhorn/aws-lambda-chaos-injection)
  - Python library to inject chaos into your Lambda function using code manipulation
- [failure-lambda](https://github.com/gunnargrosch/failure-lambda)
  - Node.js library to inject chaos into your Lambda using function code manipulation
- [Lambda Extensions](https://docs.aws.amazon.com/lambda/latest/dg/lambda-extensions.html)
  - Extensions can be used to write your own chaos tooling for AWS Lambda. In this demo will use the preexisting tool [chaos-lambda-extension](https://github.com/aws-cli-tools/chaos-lambda-extension).

### Chaos Toolkit (WIP)

The Chaos Toolkit uses experiment definitions to define your chaos experiments.

To perform those experiments run the following command:

```
chaos run --hypothesis-strategy=continuously \
          --hypothesis-frequency=10 \
          --fail-fast \
          --rollback-strategy=always \
            lambda_experiment.json
```

Use the provided scripts for this. Change the environment variables according to your deployed resources.

```
cd chaos_toolkit
. ./run-code-manipulation-experiment.sh
. ./run-concurrency-experiment.sh
```

### FIS

To start the FIS experiments you can simply go into the AWS console and select the FIS service.
Select the deployed experiment template to run the experiment.
