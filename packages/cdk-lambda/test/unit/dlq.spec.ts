import path from "path";

import { CfnElement, Stack, aws_kms, Aspects, App } from "aws-cdk-lib";
import { Match, Template, Annotations } from "aws-cdk-lib/assertions";
import { HIPAASecurityChecks } from "cdk-nag";

import { DeadLetterQueue } from "../../lib/dlq/queue";
import { Lambda } from "../../lib/lambda";

describe("Dead Letter Queue", () => {
  describe("General", () => {
    it("should match the snapshot", () => {
      // Given
      const stack = new Stack();
      const source = new Lambda(stack, "handler", {
        file: path.join(__dirname, "./mocks/function.ts"),
        name: "some-lambda-function",
      });

      // When
      new DeadLetterQueue(stack, "dlq", {
        name: "some-lambda-function",
        source: source,
      });

      // Then
      expect(Template.fromStack(stack)).toMatchSnapshot();
    });

    it("should setup an alarm", () => {
      // Given
      const stack = new Stack();
      const source = new Lambda(stack, "handler", {
        file: path.join(__dirname, "./mocks/function.ts"),
        name: "some-lambda-function",
      });

      // When
      new DeadLetterQueue(stack, "dlq", {
        name: "some-lambda-function",
        source: source,
      });

      // Then
      const template = Template.fromStack(stack);
      template.resourceCountIs("AWS::CloudWatch::Alarm", 1);
    });
  });

  describe("Encryption", () => {
    it("should use SSE-KMS if no encryption key is provided", () => {
      const stack = new Stack();
      const source = new Lambda(stack, "handler", {
        file: path.join(__dirname, "./mocks/function.ts"),
        name: "some-lambda-function",
      });
      const dlqName = "some-dlq-name";

      // When
      new DeadLetterQueue(stack, "dlq", {
        name: dlqName,
        source: source,
      });

      // Then
      const template = Template.fromStack(stack);
      template.hasResourceProperties("AWS::SQS::Queue", {
        KmsMasterKeyId: "alias/aws/sqs",
      });
    });

    it("should use custom KMS", () => {
      const stack = new Stack();
      const source = new Lambda(stack, "handler", {
        file: path.join(__dirname, "./mocks/function.ts"),
        name: "some-lambda-function",
      });
      const dlqName = "some-dlq-name";
      const key = new aws_kms.Key(stack, "key", {
        alias: "my-key",
      });

      // When
      new DeadLetterQueue(stack, "dlq", {
        name: dlqName,
        encryption: key,
        source: source,
      });

      // Then
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::SQS::Queue", {
        KmsMasterKeyId: {
          "Fn::GetAtt": [Match.anyValue(), "Arn"],
        },
      });
    });
  });

  describe("DLQ Lambda Handler", () => {
    it("should have a lambda function", () => {
      const stack = new Stack();
      const source = new Lambda(stack, "handler", {
        file: path.join(__dirname, "./mocks/function.ts"),
        name: "some-lambda-function",
      });

      // When
      new DeadLetterQueue(stack, "dlq", {
        name: "some-dlq-name",
        source: source,
      });

      // Then
      const template = Template.fromStack(stack);
      template.resourceCountIs("AWS::Lambda::Function", 2);
    });

    it("should have appropriate environment variables", () => {
      const stack = new Stack();
      const source = new Lambda(stack, "handler", {
        file: path.join(__dirname, "./mocks/function.ts"),
        name: "some-lambda-function",
      });

      // When
      const dlq = new DeadLetterQueue(stack, "dlq", {
        name: "some-dlq-name",
        source: source,
      });

      // Expect
      const expectedDqlRef = stack.getLogicalId(
        dlq.cdk.queue.node.defaultChild as CfnElement,
      );
      const expectedLambdaRef = stack.getLogicalId(
        source.cdk.function.node.defaultChild as CfnElement,
      );

      // Then
      const template = Template.fromStack(stack);
      template.hasResourceProperties("AWS::Lambda::Function", {
        Environment: {
          Variables: {
            DLQ_URL: {
              Ref: expectedDqlRef,
            },
            LAMBDA_DESTINATION_ARN: {
              "Fn::GetAtt": [expectedLambdaRef, "Arn"],
            },
          },
        },
      });
    });

    it("should have invocation permission to the source function", () => {
      const stack = new Stack();
      const source = new Lambda(stack, "handler", {
        file: path.join(__dirname, "./mocks/function.ts"),
        name: "some-lambda-function",
      });

      // When
      const dlq = new DeadLetterQueue(stack, "dlq", {
        name: "some-dlq-name",
        source: source,
      });

      // Expect
      const expectedLambdaRef = stack.getLogicalId(
        source.cdk.function.node.defaultChild as CfnElement,
      );
      const expectedDlqHandlerRoleRef = stack.getLogicalId(
        dlq.cdk.queueProcessor.cdk.function.role?.node
          .defaultChild as CfnElement,
      );

      // Then
      const template = Template.fromStack(stack);
      template.hasResourceProperties("AWS::IAM::Policy", {
        PolicyDocument: {
          Statement: Match.arrayWith([
            {
              Action: "lambda:InvokeFunction",
              Effect: "Allow",
              Resource: [
                {
                  "Fn::GetAtt": [expectedLambdaRef, "Arn"],
                },
                {
                  "Fn::Join": [
                    "",
                    [
                      {
                        "Fn::GetAtt": [expectedLambdaRef, "Arn"],
                      },
                      ":*",
                    ],
                  ],
                },
              ],
            },
          ]),
          Version: "2012-10-17",
        },
        Roles: [
          {
            Ref: expectedDlqHandlerRoleRef,
          },
        ],
      });
    });

    it("should have permissions to read from the DLQ queue", () => {
      const stack = new Stack();
      const source = new Lambda(stack, "handler", {
        file: path.join(__dirname, "./mocks/function.ts"),
        name: "some-lambda-function",
      });

      // When
      const dlq = new DeadLetterQueue(stack, "dlq", {
        name: "some-dlq-name",
        source: source,
      });

      // Expect
      const expectedDqlRef = stack.getLogicalId(
        dlq.cdk.queue.node.defaultChild as CfnElement,
      );
      const expectedDlqHandlerRoleRef = stack.getLogicalId(
        dlq.cdk.queueProcessor.cdk.function.role?.node
          .defaultChild as CfnElement,
      );
      // Then
      const template = Template.fromStack(stack);
      // 2. Should have a Lambda permission to retrieve messages from the DLQ. and
      //    to send messages to the original Lambda function.
      template.hasResourceProperties("AWS::IAM::Policy", {
        PolicyDocument: {
          Statement: Match.arrayWith([
            {
              Action: [
                "sqs:ReceiveMessage",
                "sqs:ChangeMessageVisibility",
                "sqs:GetQueueUrl",
                "sqs:DeleteMessage",
                "sqs:GetQueueAttributes",
              ],
              Effect: "Allow",
              Resource: {
                "Fn::GetAtt": [expectedDqlRef, "Arn"],
              },
            },
          ]),
          Version: "2012-10-17",
        },
        Roles: [
          {
            Ref: expectedDlqHandlerRoleRef,
          },
        ],
      });
    });
  });
});
