import path from "path";

import { CfnElement, Stack, aws_kms } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";

import { DeadLetterQueue } from "../../lib/dlq/queue";
import { Lambda } from "../../lib/lambda";

describe("Dead Letter Queue", () => {
  it("should setup an alarm", () => {
    // Given
    const stack = new Stack();

    // When
    new DeadLetterQueue(stack, "dlq", {
      name: "some-lambda-function",
    });

    // Then
    const template = Template.fromStack(stack);
    expect(template).toMatchSnapshot();
    template.resourceCountIs("AWS::SQS::Queue", 1);
    template.resourceCountIs("AWS::CloudWatch::Alarm", 1);
  });

  it("should use SSE-KMS if no encryption key is provided", () => {
    const stack = new Stack();
    const dlqName = "some-dlq-name";

    // When
    new DeadLetterQueue(stack, "dlq", {
      name: dlqName,
    });

    // Then
    const template = Template.fromStack(stack);
    template.hasResourceProperties("AWS::SQS::Queue", {
      KmsMasterKeyId: "alias/aws/sqs",
      QueueName: `${dlqName}--dlq`,
    });
  });

  it("should use custom KMS", () => {
    const stack = new Stack();
    const dlqName = "some-dlq-name";
    const key = new aws_kms.Key(stack, "key", {
      alias: "my-key",
    });

    // When
    new DeadLetterQueue(stack, "dlq", {
      name: dlqName,
      encryption: key,
    });

    // Then
    const template = Template.fromStack(stack);

    template.hasResourceProperties("AWS::SQS::Queue", {
      KmsMasterKeyId: {
        "Fn::GetAtt": [Match.anyValue(), "Arn"],
      },
      QueueName: `${dlqName}--dlq`,
    });
  });

  it("should enable redrive for Lambda function", () => {
    const stack = new Stack();
    const handler = new Lambda(stack, "handler", {
      file: path.join(__dirname, "../../lib/dlq/handler.ts"),
      name: "some-lambda-function",
    });
    const dlq = new DeadLetterQueue(stack, "dlq", {
      name: "some-dlq-name",
    });

    // When
    const dlqRedriveHandler = dlq.attachRedrive(handler);

    // Expect
    const expectedDqlRef = stack.getLogicalId(
      dlq.cdk.queue.node.defaultChild as CfnElement,
    );
    const expectedLambdaRef = stack.getLogicalId(
      handler.cdk.function.node.defaultChild as CfnElement,
    );
    const expectedDlqHanderRoleRef = stack.getLogicalId(
      dlqRedriveHandler.cdk.function.role?.node.defaultChild as CfnElement,
    );
    // Then
    const template = Template.fromStack(stack);
    // 1. Should have a Lambda function with the original lambda function as a
    //    destination, and the DLQ as the source.
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
          Ref: expectedDlqHanderRoleRef,
        },
      ],
    });
  });
});
