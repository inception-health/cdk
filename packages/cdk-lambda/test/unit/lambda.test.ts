import path from "path";

import {
  aws_dynamodb,
  aws_kms,
  aws_logs,
  CfnElement,
  Stack,
} from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";

import { Lambda } from "../../lib/lambda";

describe("Lambda", () => {
  let oldEnv: any;

  beforeAll(() => {
    oldEnv = process.env;
    process.env = { ...oldEnv, CDK_DEFAULT_REGION: "us-east-2" };
  });

  afterAll(() => {
    process.env = oldEnv;
  });

  it("should have a minimum build", () => {
    // Given
    const stack = new Stack();

    // When
    new Lambda(stack, "lambda-demo", {
      name: "hello-world",
      file: path.join(__dirname, "./mocks/function.ts"),
    });

    // Then
    const template = Template.fromStack(stack);
    template.resourceCountIs("AWS::Lambda::Function", 2);
  });

  it("should match a build with all configuration", () => {
    // Given
    const stack = new Stack();
    const key = new aws_kms.Key(stack, "key");

    // When
    new Lambda(stack, "lambda-demo", {
      name: "hello-world",
      description: "here is a demo description of the lambda",
      file: path.join(__dirname, "./mocks/function.ts"),
      handler: "handler2.ts",
      environment: {
        HELLO_WORLD_ENV: "test-demo-env",
      },
      encryption: key,
    });

    // Then
    const template = Template.fromStack(stack);
    template.resourceCountIs("AWS::Lambda::Function", 2);
    template.hasResourceProperties("AWS::Lambda::Function", {
      Description: "here is a demo description of the lambda",
      Handler: "handler2.ts",
      Environment: {
        Variables: {
          HELLO_WORLD_ENV: "test-demo-env",
        },
      },
      KmsKeyArn: Match.anyValue(),
    });
  });

  it("should have a log group associated with the lambda", () => {
    // Given
    const stack = new Stack();

    // When
    const lambda = new Lambda(stack, "lambda-demo", {
      name: "hello-world",
      file: path.join(__dirname, "./mocks/function.ts"),
    });

    // Then
    const template = Template.fromStack(stack);
    const expectedRefLog = stack.getLogicalId(
      lambda.cdk.logGroup.node.defaultChild as CfnElement,
    );

    template.hasResourceProperties("AWS::Lambda::Function", {
      LoggingConfig: {
        LogGroup: {
          Ref: expectedRefLog,
        },
      },
    });
  });

  it("should have a role associated with the lambda", () => {
    // Given
    const stack = new Stack();

    // When
    const lambda = new Lambda(stack, "lambda-demo", {
      name: "hello-world",
      file: path.join(__dirname, "./mocks/function.ts"),
    });

    // Then
    const template = Template.fromStack(stack);
    const expectedRefRole = stack.getLogicalId(
      lambda.cdk.role.node.defaultChild as CfnElement,
    );

    template.hasResourceProperties("AWS::Lambda::Function", {
      Role: {
        "Fn::GetAtt": [expectedRefRole, "Arn"],
      },
    });

    template.hasResourceProperties("AWS::IAM::Role", {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: "sts:AssumeRole",
            Effect: "Allow",
            Principal: {
              Service: "lambda.amazonaws.com",
            },
          },
        ],
        Version: "2012-10-17",
      },
      ManagedPolicyArns: [
        {
          "Fn::Join": [
            "",
            [
              "arn:",
              {
                Ref: "AWS::Partition",
              },
              ":iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
            ],
          ],
        },
        {
          "Fn::Join": [
            "",
            [
              "arn:",
              {
                Ref: "AWS::Partition",
              },
              ":iam::aws:policy/CloudWatchLambdaInsightsExecutionRolePolicy",
            ],
          ],
        },
      ],
    });
  });

  it("should have logs with a default retention period", () => {
    // Given
    const stack = new Stack();

    // When
    new Lambda(stack, "lambda-demo", {
      name: "hello-world",
      file: path.join(__dirname, "./mocks/function.ts"),
    });

    // Then
    const template = Template.fromStack(stack);
    template.hasResourceProperties("AWS::Logs::LogGroup", {
      RetentionInDays: 60,
    });
  });

  it("should have logs with a custom retention period", () => {
    // Given
    const stack = new Stack();

    // When
    new Lambda(stack, "lambda-demo", {
      name: "hello-world",
      file: path.join(__dirname, "./mocks/function.ts"),
      logRetention: aws_logs.RetentionDays.ONE_WEEK,
    });

    // Then
    const template = Template.fromStack(stack);
    template.hasResourceProperties("AWS::Logs::LogGroup", {
      RetentionInDays: 7,
    });
  });

  it("should have logs formatted as JSON", () => {
    // Given
    const stack = new Stack();

    // When
    new Lambda(stack, "lambda-demo", {
      name: "hello-world",
      file: path.join(__dirname, "./mocks/function.ts"),
    });

    // Then
    const template = Template.fromStack(stack);
    template.hasResourceProperties("AWS::Lambda::Function", {
      LoggingConfig: {
        LogFormat: "JSON",
      },
    });
  });

  it("should have INFO logging level by default", () => {
    // Given
    const stack = new Stack();

    // When
    new Lambda(stack, "lambda-demo", {
      name: "hello-world",
      file: path.join(__dirname, "./mocks/function.ts"),
    });

    // Then
    const template = Template.fromStack(stack);
    template.hasResourceProperties("AWS::Lambda::Function", {
      LoggingConfig: {
        ApplicationLogLevel: "INFO",
        SystemLogLevel: "INFO",
      },
    });
  });

  it("should be able to grant permissions to a role", () => {
    // Given
    const stack = new Stack();
    const lambda = new Lambda(stack, "lambda-demo", {
      name: "hello-world",
      file: path.join(__dirname, "./mocks/function.ts"),
    });
    const table = new aws_dynamodb.TableV2(stack, "store-demo", {
      partitionKey: { name: "id", type: aws_dynamodb.AttributeType.STRING },
    });

    // When
    table.grantReadData(lambda);

    // Then
    const template = Template.fromStack(stack);
    const expectedRefTable = stack.getLogicalId(
      table.node.defaultChild as CfnElement,
    );

    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          {
            Action: [
              "dynamodb:BatchGetItem",
              "dynamodb:GetRecords",
              "dynamodb:GetShardIterator",
              "dynamodb:Query",
              "dynamodb:GetItem",
              "dynamodb:Scan",
              "dynamodb:ConditionCheckItem",
              "dynamodb:DescribeTable",
            ],
            Effect: "Allow",
            Resource: {
              "Fn::GetAtt": [expectedRefTable, "Arn"],
            },
          },
        ]),
        Version: "2012-10-17",
      },
    });
  });
});
