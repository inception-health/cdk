import {
  Duration,
  aws_cloudwatch,
  aws_cloudwatch_actions,
  aws_dynamodb,
  aws_sns,
} from "aws-cdk-lib";
import { Construct } from "constructs";

import { SecureStore } from "./store";

export interface SecureStoreAlarmsProps {
  /**
   * The SNS topic to send DevOps notifications to. The SNS topic must be
   * created in the same account and region as the DynamoDB table.
   */
  devOpsTopicArn?: string;
  /**
   * Enable System Error Alarm
   *
   * @defaultValue true
   */
  systemErrorAlarm?: boolean;

  /**
   * Enable Throttle Alarm
   *
   * @defaultValue true
   */
  throttleAlarm?: boolean;
}

interface SecureStoreAlarmsCdk {
  table: aws_dynamodb.ITable;
  topic: aws_sns.ITopic | undefined;
  widgets: aws_cloudwatch.IWidget[];
}

const defaultProps: Partial<SecureStoreAlarmsProps> = {
  systemErrorAlarm: true,
  throttleAlarm: true,
};

/**
 * `SecureStoreAlarms` is a construct that creates alarms for monitoring a
 * secure store.
 *
 * This construct is responsible for creating CloudWatch alarms for various
 * metrics related to a secure store.
 *
 * The alarms created by this construct can be used to notify operators when
 * certain conditions are met.
 *
 * @remarks
 * We currently have two alarms:
 * - DynamoDB Table Reads/Writes Throttled: This alarm triggers when the
 *   DynamoDB table is throttled for reads or writes. This alarm is triggered
 *   when the DynamoDB table is throttled for 2% of the time in the last 30
 *   minutes.
 * - DynamoDB Errors > 0: This alarm triggers when there are any errors in the
 *   DynamoDB table. This alarm is triggered when there are any errors in the
 *   DynamoDB table in the last 30 minutes.
 *
 * @example
 * ```
 * // Creating a new instance of SecureStoreAlarms
 * const secureStoreAlarms = new SecureStoreAlarms(stack, 'MySecureStoreAlarms', {
 *   secureStore: mySecureStore,
 * });
 * ```
 *
 * @see
 * https://github.com/cdk-patterns/serverless/blob/main/the-cloudwatch-dashboard/README.md
 */
export class SecureStoreAlarms extends Construct {
  public readonly cdk: SecureStoreAlarmsCdk;

  // !Private Properties
  private readonly props: SecureStoreAlarmsProps;

  constructor(scope: SecureStore, id: string, props: SecureStoreAlarmsProps) {
    super(scope, id);

    // Initialize the properties
    this.props = { ...defaultProps, ...props };
    this.cdk = {} as SecureStoreAlarmsCdk;
    this.cdk.widgets = [];

    this.cdk.table = scope.cdk.table;

    if (this.props.devOpsTopicArn)
      this.cdk.topic = aws_sns.Topic.fromTopicArn(
        this,
        "DevOpsTopic",
        this.props.devOpsTopicArn,
      );

    // ==================================
    // System Errors
    // ==================================
    if (this.props.systemErrorAlarm) this.setupSystemError();

    // ==================================
    // Read/Write Throttles
    // ==================================
    if (this.props.throttleAlarm) this.setupThrottle();

    // ==================================
    // Cloudwatch Widgets
    // ==================================
    this.setupCloudwatchWidgets();
  }

  // !Private Methods
  private buildGraphWidget(
    widgetName: string,
    metrics: aws_cloudwatch.IMetric[],
    stacked = false,
  ): aws_cloudwatch.GraphWidget {
    const widget = new aws_cloudwatch.GraphWidget({
      title: widgetName,
      left: metrics,
      stacked: stacked,
      width: 8,
    });
    this.cdk.widgets.push(widget);
    return widget;
  }

  // !Private Setup
  private setupSystemError() {
    // ----------------------------------
    // Metric
    // ----------------------------------
    const metric = this.cdk.table.metricSystemErrorsForOperations({
      operations: [
        aws_dynamodb.Operation.GET_ITEM,
        aws_dynamodb.Operation.PUT_ITEM,
        aws_dynamodb.Operation.DELETE_ITEM,
        aws_dynamodb.Operation.UPDATE_ITEM,
        aws_dynamodb.Operation.TRANSACT_WRITE_ITEMS,
        aws_dynamodb.Operation.TRANSACT_GET_ITEMS,
        aws_dynamodb.Operation.BATCH_GET_ITEM,
        aws_dynamodb.Operation.BATCH_WRITE_ITEM,
        aws_dynamodb.Operation.QUERY,
        aws_dynamodb.Operation.SCAN,
      ],
      period: Duration.minutes(5),
    });

    // ----------------------------------
    // Alarm
    // ----------------------------------
    const alarm = new aws_cloudwatch.Alarm(this, "alarm-errors", {
      alarmName: `DynamoDB ${this.cdk.table.tableName} System Errors`,
      // Metric
      metric: metric,
      // Configuration
      threshold: 0,
      evaluationPeriods: 6,
      datapointsToAlarm: 1,
      treatMissingData: aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // ----------------------------------
    // Actions
    // ----------------------------------
    // If a topic is defined in the CDK stack, an SNS action is added to the
    // alarm. This means that when the alarm state changes, a message will be
    // published to the SNS topic.
    if (this.cdk.topic)
      alarm.addAlarmAction(
        new aws_cloudwatch_actions.SnsAction(this.cdk.topic),
      );
  }

  private setupThrottle() {
    // ----------------------------------
    // Metric
    // ----------------------------------
    // The purpose of this metric is to monitor the throttling events of
    // DynamoDB. It combines the `ReadThrottleEvents` and `WriteThrottleEvents` into
    // a single metric. The statistic used is `'sum'`, which means it will add up
    // all the throttle events in the specified period. The period is set to 5
    // minutes, meaning the metric data points are emitted every 5 minutes.
    const metric = new aws_cloudwatch.MathExpression({
      expression: "m1 + m2",
      label: `DynamoDB ${this.cdk.table.tableName} Reads/Writes Throttled`,
      usingMetrics: {
        m1: this.cdk.table.metric("ReadThrottleEvents", { statistic: "sum" }),
        m2: this.cdk.table.metric("WriteThrottleEvents", { statistic: "sum" }),
      },
      period: Duration.minutes(5),
    });

    // ----------------------------------
    // Alarm
    // ----------------------------------
    // The purpose of this alarm is to trigger when there are any DynamoDB
    // throttling events. The alarm is configured to trigger when the metric
    // value is greater than 0. The evaluationPeriods is set to 6, meaning the
    // alarm will look at the last 6 periods (or 30 minutes) of data. The
    // datapointsToAlarm is set to 1, meaning the alarm will trigger if any
    // single data point in the evaluation period breaches the threshold. The
    // treatMissingData is set to NOT_BREACHING, meaning if there are any
    // periods of missing data, they will not count as breaching the threshold.
    const alarm = new aws_cloudwatch.Alarm(this, "alarm-throttle", {
      alarmName: `DynamoDB ${this.cdk.table.tableName} Throttled`,
      // Metric
      metric: metric,
      // Configuration
      threshold: 0,
      evaluationPeriods: 6,
      datapointsToAlarm: 1,
      treatMissingData: aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // ----------------------------------
    // Actions
    // ----------------------------------
    // If a topic is defined in the CDK stack, an SNS action is added to the
    // alarm. This means that when the alarm state changes, a message will be
    // published to the SNS topic.
    if (this.cdk.topic)
      alarm.addAlarmAction(
        new aws_cloudwatch_actions.SnsAction(this.cdk.topic),
      );
  }

  private setupCloudwatchWidgets() {
    // ----------------------------------
    // DynamoDB Latency
    // ----------------------------------
    this.buildGraphWidget(
      `DynamoDB ${this.cdk.table.tableName} Latency`,
      ["GetItem", "UpdateItem", "PutItem", "DeleteItem", "Query"].map((op) => {
        return this.cdk.table.metricSuccessfulRequestLatency({
          dimensionsMap: {
            TableName: this.cdk.table.tableName,
            Operation: op,
          },
        });
      }),
      true,
    );

    // ----------------------------------
    // DynamoDB Consumed Read/Write Units
    // ----------------------------------
    this.buildGraphWidget(
      `DynamoDB ${this.cdk.table.tableName} Consumed Read/Write Units`,
      [
        this.cdk.table.metricConsumedReadCapacityUnits(),
        this.cdk.table.metricConsumedWriteCapacityUnits(),
      ],
      true,
    );

    // ----------------------------------
    // DynamoDB Throttles
    // ----------------------------------
    this.buildGraphWidget(
      `DynamoDB ${this.cdk.table.tableName} Throttles`,
      [
        this.cdk.table.metric("ReadThrottleEvents", { statistic: "sum" }),
        this.cdk.table.metric("WriteThrottleEvents", { statistic: "sum" }),
      ],
      true,
    );
  }
}
