import {
  aws_events,
  aws_events_targets,
  aws_kms,
  aws_logs,
  aws_sns,
} from "aws-cdk-lib";
import { Construct } from "constructs";

export interface SecureStoreNotificationProps {
  /**
   * The SNS Topic to send notifications to.
   */
  destination: string;
  /**
   * Enable CloudWatch Logs for the EventBridge rule.
   *
   * @defaultValue false
   */
  enableLogs?: boolean;
  /**
   * Enable or disable the notification.
   *
   * @defaultValue true
   */
  enabled?: boolean;
  /**
   * The encryption key to use for encrypting the sns topic and the logs
   *
   * @remarks
   * The encryption key must be created in the same account and region as the
   * DynamoDB table. It also must have the following policy attached to it:
   * ```
   * {
   *   "Sid": "Allow access to CloudWatch Log",
   *   "Effect": "Allow",
   *   "Principal": {
   *       "Service": "logs.REGION.amazonaws.com"
   *   },
   *   "Action": [
   *       "kms:Encrypt",
   *       "kms:Decrypt",
   *       "kms:ReEncrypt*",
   *       "kms:GenerateDataKey*",
   *       "kms:DescribeKey"
   *   ],
   *   "Resource": "*",
   *   "Condition": {
   *       "ArnLike": {
   *           "kms:EncryptionContext:aws:logs:arn": "arn:aws:logs:REGION:ACCOUNT_ID:*"
   *       }
   *   }
   * }
   *```
   */
  encryptionKey: aws_kms.IKey;
  /**
   * The secure store table name
   */
  sourceTable: string;
}

const defaultProps: Partial<SecureStoreNotificationProps> = {
  enabled: true,
  enableLogs: true,
};

interface SecureStoreNotificationResources {
  bus: aws_events.IEventBus;
  logs: aws_logs.LogGroup;
  rule: aws_events.Rule;
  topic: aws_sns.ITopic;
}

/**
 * `Notification` is a construct that creates a notification for specific
 *  DynamoDB events. The notification is sent to the provided SNS topic.
 *
 * At the moment, the notification is sent for the following events:
 * - CreateTable
 * - DeleteTable
 * - UpdateTable
 * - DeleteBackup
 * - RestoreTableFromBackup
 * - RestoreTableToPointInTime
 *
 * @remarks
 * For the full list of events that trigger a notification, see the [DynamoDB
 * documentation](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/logging-using-cloudtrail.html).
 */
export class SecureStoreNotification extends Construct {
  public readonly cdk: SecureStoreNotificationResources;

  // !Private Properties
  private readonly props: SecureStoreNotificationProps;

  // !Constructor
  constructor(
    scope: Construct,
    id: string,
    props: SecureStoreNotificationProps,
  ) {
    super(scope, id);

    // Initialize the properties
    this.props = { ...defaultProps, ...props };
    this.cdk = {} as SecureStoreNotificationResources;

    // Create Resources
    this.setupTopic();

    this.setupBus();

    this.setupRule();

    this.setupLogs();
  }

  // !Private Methods
  private setupTopic() {
    this.cdk.topic = aws_sns.Topic.fromTopicArn(
      this,
      "topic",
      this.props.destination,
    );
  }

  private setupBus() {
    this.cdk.bus = aws_events.EventBus.fromEventBusName(
      this,
      "eventBus",
      "default",
    );
  }

  private setupRule() {
    this.cdk.rule = new aws_events.Rule(this, "rule", {
      ruleName: `${this.props.sourceTable}-dynamodb--monitoring`,
      description: `Send system notifications related to the ${this.props.sourceTable} table.`,
      enabled: this.props.enabled,
      eventBus: this.cdk.bus,
      eventPattern: {
        source: ["aws.dynamodb"],
        detailType: ["AWS API Call via CloudTrail"],
        detail: {
          eventSource: ["dynamodb.amazonaws.com"],
          eventName: [
            "CreateTable",
            "DeleteTable",
            "UpdateTable",
            "DeleteBackup",
            "RestoreTableFromBackup",
            "RestoreTableToPointInTime",
          ],
          requestParameters: {
            tableName: [this.props.sourceTable],
          },
        },
      },
    });

    // Add the target to the rule
    this.cdk.rule.addTarget(new aws_events_targets.SnsTopic(this.cdk.topic));
  }

  private setupLogs() {
    if (!this.props.enableLogs) return;

    // New Cloudwatch Log Group to deliver EventBridge Events to.
    this.cdk.logs = new aws_logs.LogGroup(this, "logs", {
      logGroupName: `/inception/devops/${this.props.sourceTable}-dynamodb--monitoring`,
      retention: aws_logs.RetentionDays.TWO_WEEKS,
      encryptionKey: this.props.encryptionKey,
    });

    // Define rule that will deliver EventBridge events to a Cloudwatch Log Group
    this.cdk.rule.addTarget(
      new aws_events_targets.CloudWatchLogGroup(this.cdk.logs),
    );
  }
}
