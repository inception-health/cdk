import { aws_kms, aws_sns } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { Stack } from "aws-cdk-lib/core";

import { SecureStoreAlarms } from "../lib/alarm";
import { SecureStore } from "../lib/store";

describe("SecureStoreAlarms", () => {
  let stack: Stack;
  let store: SecureStore;
  let topic: aws_sns.ITopic;

  beforeEach(() => {
    stack = new Stack(undefined, undefined, {
      env: { region: "us-east-1" },
    });
    store = new SecureStore(stack, "store", {
      encryptionKey: new aws_kms.Key(stack, "key"),
      tableName: "table",
    });
    topic = aws_sns.Topic.fromTopicArn(
      stack,
      "topic",
      "arn:aws:sns:us-east-1:123456789012:topic",
    );
  });

  it("should match the snapshot", () => {
    new SecureStoreAlarms(store, "MySecureStoreAlarms", {
      alertsTopic: topic.topicArn,
      systemErrorAlarm: true,
      throttleAlarm: true,
    });

    // then
    expect(Template.fromStack(stack)).toMatchSnapshot();
  });

  it("should create a new instance of SecureStoreAlarms", () => {
    const secureStoreAlarms = new SecureStoreAlarms(
      store,
      "MySecureStoreAlarms",
      {
        alertsTopic: topic.topicArn,
        systemErrorAlarm: true,
        throttleAlarm: true,
      },
    );

    expect(secureStoreAlarms).toBeInstanceOf(SecureStoreAlarms);
  });

  it("should setup system error alarm if systemErrorAlarm prop is true", () => {
    new SecureStoreAlarms(store, "MySecureStoreAlarms", {
      alertsTopic: topic.topicArn,
      systemErrorAlarm: true,
      throttleAlarm: false,
    });

    // Then
    // Template.fromStack(stack).resourceCountIs("AWS::CloudWatch::Alarm", 1);
    Template.fromStack(stack).hasResourceProperties("AWS::CloudWatch::Alarm", {
      ComparisonOperator: "GreaterThanOrEqualToThreshold",
      DatapointsToAlarm: 1,
      EvaluationPeriods: 6,
      Metrics: Match.arrayWith([
        {
          Id: "getitem",
          MetricStat: {
            Metric: Match.objectLike({
              MetricName: "SystemErrors",
              Namespace: "AWS/DynamoDB",
            }),
            Period: 300,
            Stat: "Sum",
          },
          ReturnData: false,
        },
      ]),
    });
  });

  it("should setup throttle alarm if throttleAlarm prop is true", () => {
    new SecureStoreAlarms(store, "MySecureStoreAlarms", {
      alertsTopic: topic.topicArn,
      systemErrorAlarm: false,
      throttleAlarm: true,
    });

    // Then
    // Template.fromStack(stack).resourceCountIs("AWS::CloudWatch::Alarm", 1);
    Template.fromStack(stack).hasResourceProperties("AWS::CloudWatch::Alarm", {
      ComparisonOperator: "GreaterThanOrEqualToThreshold",
      DatapointsToAlarm: 1,
      EvaluationPeriods: 6,
      Metrics: Match.arrayWith([
        {
          Id: "getitem",
          MetricStat: {
            Metric: Match.objectLike({
              MetricName: "SystemErrors",
              Namespace: "AWS/DynamoDB",
            }),
            Period: 300,
            Stat: "Sum",
          },
          ReturnData: false,
        },
      ]),
    });
  });
});
