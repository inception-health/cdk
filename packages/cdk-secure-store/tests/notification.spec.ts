import { Stack, aws_kms } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";

import { SecureStoreNotification } from "../lib/notification";

/**
 * In this test, we are testing the Notification construct.
 *
 * - It checks if a topic is created from the destination ARN.
 * - It checks if a rule is created with the correct properties.
 * - It checks if the topic is added as a target to the rule.
 */
describe("Notification", () => {
  let stack: Stack;
  let destination: string;
  let encryptionKey: aws_kms.IKey;

  beforeEach(() => {
    stack = new Stack();
    destination = "arn:aws:sns:us-east-1:123456789012:topic";
    encryptionKey = aws_kms.Key.fromKeyArn(
      stack,
      "key",
      "arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012",
    );
  });
  it("should match the snapshot", () => {
    // When
    new SecureStoreNotification(stack, "notification", {
      destination,
      sourceTable: "MyTable",
      encryptionKey: encryptionKey,
    });

    // Then
    expect(Template.fromStack(stack)).toMatchSnapshot();
  });

  it("should assign the destination ARN", () => {
    // When
    const notification = new SecureStoreNotification(stack, "notification", {
      destination,
      sourceTable: "MyTable",
      encryptionKey: encryptionKey,
    });

    // Then
    expect(notification.cdk.topic.topicArn).toEqual(destination);
  });

  it("should create a rule with the correct properties", () => {
    // When
    new SecureStoreNotification(stack, "notification", {
      destination,
      sourceTable: "MyTable",
      encryptionKey: encryptionKey,
    });

    // Then
    const template = Template.fromStack(stack);
    template.allResourcesProperties("AWS::Events::Rule", {
      EventPattern: {
        detail: {
          eventName: [
            "CreateTable",
            "DeleteTable",
            "UpdateTable",
            "DeleteBackup",
            "RestoreTableFromBackup",
            "RestoreTableToPointInTime",
          ],
          eventSource: ["dynamodb.amazonaws.com"],
          requestParameters: {
            tableName: ["MyTable"],
          },
        },
        "detail-type": ["AWS API Call via CloudTrail"],
        source: ["aws.dynamodb"],
      },
    });
  });

  it("should add the topic as a target to the rule", () => {
    // When
    new SecureStoreNotification(stack, "notification", {
      destination,
      sourceTable: "MyTable",
      encryptionKey: encryptionKey,
    });

    // Then
    const template = Template.fromStack(stack);
    template.hasResourceProperties("AWS::Events::Rule", {
      Targets: [
        {
          Arn: destination,
          Id: "Target0",
        },
        {
          Arn: Match.anyValue(),
          Id: "Target1",
        },
      ],
    });
  });

  it("should not have logging as target if disabled", () => {
    // When
    new SecureStoreNotification(stack, "notification", {
      destination,
      sourceTable: "MyTable",
      encryptionKey: encryptionKey,
      // WHEN
      enableLogs: false,
    });

    // Then
    const template = Template.fromStack(stack);
    template.hasResourceProperties("AWS::Events::Rule", {
      Targets: [
        {
          Arn: destination,
          Id: "Target0",
        },
      ],
    });
  });

  it("should have logging using the encryption key", () => {
    // When
    new SecureStoreNotification(stack, "notification", {
      destination,
      sourceTable: "MyTable",
      // WHEN
      encryptionKey: encryptionKey,
    });

    // Then
    const template = Template.fromStack(stack);
    template.hasResourceProperties("AWS::Logs::LogGroup", {
      KmsKeyId: encryptionKey.keyArn,
    });
  });
});
