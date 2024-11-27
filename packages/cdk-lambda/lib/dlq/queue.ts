import path from "path";

import { Duration, aws_cloudwatch, aws_kms, aws_sqs } from "aws-cdk-lib";
import { Construct } from "constructs";

import { Lambda } from "../lambda";

export interface DeadLetterQueueProps {
  /**
   * CloudWatch alarm to trigger when the queue has new events.
   *
   * @defaultValue true
   */
  disableAlarm?: boolean;

  /**
   * The encryption key to use for encrypting messages in the queue.
   */
  encryption?: aws_kms.IKey;

  /**
   * Name of the dead letter queue.
   */
  name: string;
}

const defaultProps: Partial<DeadLetterQueueProps> = {
  disableAlarm: true,
};

/**
 * A dead letter queue (DLQ) is a queue that receives messages from another
 * queue that the other queue failed to process successfully.
 *
 * In the event that something does go wrong, you need to have a plan to
 * retrieve your messages. So your strategy may change depending on what your
 * event source is. But a common one that works for almost all cases, write a
 * separate lambda function (discussed below) that can pull your DLQ and
 * re-inject those messages back into your original lambda.
 */
export class DeadLetterQueue extends Construct {
  public readonly cdk: {
    alarm: aws_cloudwatch.Alarm | undefined;
    queue: aws_sqs.IQueue;
  };

  private readonly props: DeadLetterQueueProps;

  constructor(scope: Construct, id: string, props: DeadLetterQueueProps) {
    super(scope, id);

    this.props = Object.assign({}, defaultProps, props);
    this.cdk = {} as any;

    // Create the dead letter queue
    this.setupDlq();

    // Create the alarm
    this.setupAlarm();
  }

  // !Public
  /**
   * Creates a lambda function to handle the dead letter queue.
   *
   * @param target The lambda function to send the messages to.
   * @returns The lambda function that was attached to the dead letter queue.
   */
  public attachRedrive(target: Lambda): Lambda {
    const lambda = new Lambda(this, "redrive", {
      file: path.join(__dirname, "./handler.ts"),
      handler: "handler",
      name: `${target.cdk.function.functionName}--dlq`,
      // Note: This is important to disable DLQ for the redrive function
      // otherwise it will create an infinite loop.
      deadLetterQueue: false,
      description: `Redrive function for ${target.cdk.function.functionName} dead letter queue`,
      environment: {
        DLQ_URL: this.cdk.queue.queueUrl,
        LAMBDA_DESTINATION_ARN: target.cdk.function.functionArn,
      },
    });

    // === Permissions ===
    // Grant the lambda function permissions to read from the queue
    this.cdk.queue.grantConsumeMessages(lambda.cdk.function);

    // Grant the lambda function permissions to invoke the target function
    target.cdk.function.grantInvoke(lambda.cdk.function);

    return lambda;
  }

  // !Setup
  private setupDlq() {
    this.cdk.queue = new aws_sqs.Queue(this, "queue", {
      queueName: `${this.props.name}--dlq`,
      retentionPeriod: Duration.days(14),
      encryption: this.props.encryption
        ? aws_sqs.QueueEncryption.KMS
        : aws_sqs.QueueEncryption.KMS_MANAGED,
      encryptionMasterKey: this.props.encryption,
      enforceSSL: true,
      visibilityTimeout: Duration.seconds(30),
    });
  }

  private setupAlarm() {
    if (!this.props.disableAlarm) return;

    this.cdk.alarm = new aws_cloudwatch.Alarm(this, "alarm", {
      alarmName: `${this.props.name}--dlq-alarm`,
      alarmDescription: `Alarm for ${this.props.name} dead letter queue`,
      metric: this.cdk.queue.metricApproximateNumberOfMessagesVisible(),
      threshold: 5,
      evaluationPeriods: 1,
      treatMissingData: aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });
  }
}
