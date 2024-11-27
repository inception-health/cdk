# @inception-health/cdk-lambda

## Overview

The `@inception-health/cdk-lambda` package provides a custom AWS Lambda construct for the AWS Cloud Development Kit (CDK). This construct simplifies the creation and management of AWS Lambda functions with advanced logging, monitoring, and dead letter queue (DLQ) support which support HIPAA Compliance.

## Features

- **Logging**: The Lambda function logs to CloudWatch Logs in JSON structured format, making it easier to search, filter, and analyze large volumes of log entries.
- **Monitoring**: Integration with CloudWatch Lambda Insights for advanced monitoring and troubleshooting.
- **Dead Letter Queue (DLQ)**: Automatic creation and management of a DLQ for handling failed messages.
- **Encryption**: Support for encryption using AWS KMS.
- **Customizable**: Various properties to customize the Lambda function, including environment variables, memory size, timeout, and more.

## Installation

To use this construct in your CDK application, install the package via npm:

```sh
npm install @inception-health/cdk-lambda
```

## Usage

Below is an example of how to use the Lambda construct in your CDK application:

```typescript
import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { Lambda } from "@inception-health/cdk-lambda";

export class MyStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    new Lambda(this, "MyLambdaFunction", {
      name: "myLambdaFunction",
      file: "path/to/your/lambda/handler.ts",
      handler: "handler",
      environment: {
        MY_ENV_VAR: "value",
      },
      memorySize: 256,
      timeout: Duration.seconds(60),
      deadLetterQueue: true,
      encryption: new aws_kms.Key(this, "MyKey"),
    });
  }
}
```

## API Reference

### LambdaProps

The `LambdaProps` interface defines the properties that can be passed to the `Lambda` construct.

| Property           | Type                           | Description                                           | Default Value |
| ------------------ | ------------------------------ | ----------------------------------------------------- | ------------- |
| `deadLetterQueue?` | `boolean`                      | Activate a Dead Letter Queue for the Lambda function. | `false`       |
| `description?`     | `string`                       | Description of the Lambda function.                   |               |
| `encryption?`      | `aws_kms.IKey`                 | Encryption key to be used.                            |               |
| `environment?`     | `{ [key: string]: string }`    | Environment variables for the Lambda function.        |               |
| `file`             | `string`                       | File containing the Lambda function.                  |               |
| `handler?`         | `string`                       | Handler for the Lambda function.                      | `"handler"`   |
| `logRetention?`    | `aws_logs.RetentionDays`       | Log retention period in days.                         | `2 months`    |
| `loggingLevel?`    | `"INFO" \| "DEBUG" \| "ERROR"` | Logging level.                                        | `"INFO"`      |
| `memorySize?`      | `number`                       | Memory size of the Lambda function in MB.             | `128`         |
| `name`             | `string`                       | Name of the Lambda function.                          |               |
| `storage?`         | `Size`                         | Ephemeral storage for the Lambda function.            | `512 MB`      |
| `timeout?`         | `Duration`                     | Timeout of the Lambda function.                       | `30 seconds`  |


### Lambda Methods

The `Lambda` class represents an AWS Lambda function in a CDK application. The Lambda construct offers additional custom methods:

- `addEnvironment(key: string, value: string)`: Adds an environment variable to the Lambda function.
- `grantInvoke(identity: aws_iam.IGrantable)`: aws_iam.Grant: Grants invoke permissions to the specified identity.

