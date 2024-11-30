import path from "path";

import { Duration, aws_cloudwatch, aws_kms, aws_sqs } from "aws-cdk-lib";
import { Construct } from "constructs";

import { Lambda } from "../lambda";

export interface DeadLetterQueueProps {
  /**
   * CloudWatch alarm to trigger when the queue has new events.
   *
   * @defaultValue false
   */
  enableAlarm?: boolean;

  /**
   * The encryption key to use for encrypting messages in the queue.
   */
  encryption?: aws_kms.IKey;

  /**
   * Name of the dead letter queue.
   */
  name?: string;

  /**
   * The source lambda function the dead letter queue is attached to.
   *
   * @remarks
   * The source lambda function is the lambda function that will send messages
   * to the dead letter queue.
   */
  source: Lambda;
}

const defaultProps: Partial<DeadLetterQueueProps> = {
  enableAlarm: true,
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
    queueProcessor: Lambda;
  };

  private readonly props: DeadLetterQueueProps;

  constructor(scope: Construct, id: string, props: DeadLetterQueueProps) {
    super(scope, id);

    this.props = Object.assign({}, defaultProps, props);
    this.cdk = {} as any;

    // Create the redrive function
    this.setupRedriveFunction();

    // Create the dead letter queue
    this.setupDlq();

    // Create the alarm
    this.setupAlarm();

    // Silence the CDK-Nag for the dead letter queue lambda
    // this.silenceCdkNag();
  }

  // !Setup
  private setupRedriveFunction() {
    this.cdk.queueProcessor = new Lambda(this, "redrive", {
      file: path.join(__dirname, "./handler.ts"),
      handler: "handler",
      name: `${this.props.name}--dlq-processor`,
      description: `Redrive function for ${this.props.name} DLQ attached to ${this.props.source.cdk.function.functionName} lambda`,
      environment: {
        LAMBDA_DESTINATION_ARN: this.props.source.cdk.function.functionArn,
      },
    });

    // Grant the lambda function permissions to invoke the target function
    this.props.source.grantInvoke(this.cdk.queueProcessor);
  }

  private setupDlq() {
    this.cdk.queue = new aws_sqs.Queue(this, "queue", {
      queueName: this.props.name,
      retentionPeriod: Duration.days(14),
      encryption: this.props.encryption
        ? aws_sqs.QueueEncryption.KMS
        : aws_sqs.QueueEncryption.KMS_MANAGED,
      encryptionMasterKey: this.props.encryption,
      enforceSSL: true,
      visibilityTimeout: Duration.seconds(30),
    });

    // === Configuration of the Queue Processor ===
    // Grant the lambda function permissions to read from the queue
    this.cdk.queue.grantConsumeMessages(this.cdk.queueProcessor);
    // Add the DLQ URL to the lambda function environment variables
    this.cdk.queueProcessor.addEnvironment("DLQ_URL", this.cdk.queue.queueUrl);
  }

  private setupAlarm() {
    if (!this.props.enableAlarm) return;
    this.cdk.alarm = new aws_cloudwatch.Alarm(this, "alarm", {
      alarmName: `${this.props.name}--dlq-alarm`,
      alarmDescription: `Alarm for ${this.props.name} dead letter queue`,
      metric: this.cdk.queue.metricApproximateNumberOfMessagesVisible(),
      threshold: 5,
      evaluationPeriods: 1,
      treatMissingData: aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });
  }

  private silenceCdkNag() {
    // this.cdk.queue.node.applyAspect({
    //   visit(node: Construct) {
    //     if (node.node.metadata.length) {
    //       node.node.metadata.forEach((meta) => {
    //         if (meta.type === "cdk-nag") {
    //           node.node.metadata.splice(node.node.metadata.indexOf(meta), 1);
    //         }
    //       });
    //     }
    //   },
    // });
  }
}
