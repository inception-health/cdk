import {
  aws_iam,
  aws_kms,
  aws_lambda,
  aws_lambda_nodejs,
  aws_secretsmanager,
  aws_logs,
  Duration,
  Size,
} from "aws-cdk-lib";
import { Construct } from "constructs";

import { DeadLetterQueue } from "./dlq/queue";

/**
 * Interface for LambdaProps
 */
export interface LambdaProps
  extends Pick<aws_lambda_nodejs.NodejsFunctionProps, "vpc" | "vpcSubnets"> {
  /**
   * Description of the lambda function
   */
  description?: string;

  /**
   * Encryption key to be used
   */
  encryption?: aws_kms.IKey;

  /**
   * Environment variables for the lambda function
   */
  environment?: { [key: string]: string };

  /**
   * File containing the lambda function
   */
  file: string;

  /**
   * Handler for the lambda function
   *
   * @defaultValue "handler"
   */
  handler?: string;

  /**
   * Log retention period in days
   *
   * @defaultValue 2 months
   */
  logRetention?: aws_logs.RetentionDays;

  /**
   * Logging level
   *
   * @defaultValue INFO
   */
  loggingLevel?: "INFO" | "DEBUG" | "ERROR";

  /**
   * Memory size of the Lambda function in MB.
   *
   * @defaultValue `128` (MB)
   */
  memorySize?: number;

  /**
   * Name of the lambda function
   */
  name: string;

  /**
   * Reserved Concurrency. Use reserved concurrency to reserve a portion of your
   * account's concurrency for a function. This is useful if you don't want
   * other functions taking up all the available unreserved concurrency.
   *
   * Reserved concurrency is the maximum number of concurrent instances that you
   * want to allocate to your function. When you dedicate reserved concurrency
   * to a function, no other function can use that concurrency. In other words,
   * setting reserved concurrency can impact the concurrency pool that's
   * available to other functions. Functions that don't have reserved
   * concurrency share the remaining pool of unreserved concurrency.
   *
   * It is recommended to set the reserved concurrency to the most important
   * functions in your application. This way, you can ensure that they have
   * access to the concurrency they need, even when other functions are consuming
   * the unreserved concurrency pool.
   *
   * @defaultValue 20
   */
  reservedConcurrency?: number;

  /**
   * Ephemeral storage for the Lambda function.
   *
   * @defaultValue 512 MB
   */
  storage?: Size;

  /**
   * Timeout of the Lambda function.
   *
   * @defaultValue 30 seconds
   */
  timeout?: Duration;
}

const defaultProps: Partial<LambdaProps> = {
  handler: "handler",
  logRetention: aws_logs.RetentionDays.TWO_MONTHS,
  timeout: Duration.seconds(30),
  memorySize: 128,
  loggingLevel: "INFO",
  storage: Size.mebibytes(512),
  reservedConcurrency: 20,
};

export interface LambdaCDK {
  encryption: aws_kms.IKey | undefined;
  function: aws_lambda.Function;
  logGroup: aws_logs.LogGroup;
  role: aws_iam.Role;
  secret: aws_secretsmanager.ISecret | undefined;
}

/**
 * `Lambda` is a class that represents an AWS Lambda function in a CDK
 * application.
 *
 * By default, the log group is encrypted with the key provided in the
 * `encryption` prop. If no key is provided, the log group is encrypted with the
 * default key provided by AWS. The log retention is set to 1 year by default.
 *
 * @example
 * ```typescript
 * const myLambda = new Lambda({
 *   name: 'myLambdaFunction',
 *   handler: 'index.handler',
 *   secretName: 'mySecret',
 * });
 * ```
 *
 * @remarks
 * - **Logging**: The lambda function logs to CloudWatch Logs. The Lambda
 *   captures logs in JSON structured format without having to use your own
 *   logging libraries. JSON structured logs make it easier to search, filter,
 *   and analyze large volumes of log entries. For more information, read about
 *   the new [AWS Lambda advanced
 *   logging](https://aws.amazon.com/blogs/compute/introducing-advanced-logging-controls-for-aws-lambda-functions/).
 *
 */
export class Lambda extends Construct implements aws_iam.IGrantable {
  public readonly cdk: LambdaCDK;

  public readonly dlq: {
    processor: Lambda | undefined;
    queue: DeadLetterQueue | undefined;
  };

  private readonly props: LambdaProps;

  constructor(scope: Construct, id: string, props: LambdaProps) {
    super(scope, id);

    // Initialize the properties
    this.props = Object.assign({}, defaultProps, props);
    this.cdk = {} as LambdaCDK;
    this.dlq = {} as Lambda["dlq"];

    // Setup
    this.setupLogGroup();
    this.setupRole();
    this.setupFunction();
    this.setupEncryption();
  }

  // !Public
  public get grantPrincipal(): aws_iam.IPrincipal {
    return this.cdk.role;
  }

  public addEnvironment(key: string, value: string) {
    this.cdk.function.addEnvironment(key, value);
  }

  public grantInvoke(identity: aws_iam.IGrantable): aws_iam.Grant {
    return this.cdk.function.grantInvoke(identity);
  }

  // !Setup
  private setupLogGroup() {
    this.cdk.logGroup = new aws_logs.LogGroup(this, "log-group", {
      logGroupName: `/aws/lambda/${this.props.name}`,
      encryptionKey: this.props.encryption,
      retention: this.props.logRetention,
    });
  }

  private setupRole() {
    this.cdk.role = new aws_iam.Role(this, "role", {
      assumedBy: new aws_iam.ServicePrincipal("lambda.amazonaws.com"),
    });
    this.cdk.role.addManagedPolicy(
      aws_iam.ManagedPolicy.fromAwsManagedPolicyName(
        "service-role/AWSLambdaBasicExecutionRole",
      ),
    );
  }

  private setupFunction() {
    this.cdk.function = new aws_lambda_nodejs.NodejsFunction(this, "function", {
      // Default
      architecture: aws_lambda.Architecture.ARM_64,
      tracing: aws_lambda.Tracing.ACTIVE,
      runtime: aws_lambda.Runtime.NODEJS_20_X,
      // Role
      role: this.cdk.role,
      // Performance
      timeout: this.props.timeout,
      memorySize: this.props.memorySize,
      ephemeralStorageSize: this.props.storage,
      reservedConcurrentExecutions: this.props.reservedConcurrency,
      // CloudWatch Lambda Insights is a monitoring and troubleshooting
      // solution for serverless applications running on AWS Lambda. The
      // solution collects, aggregates, and summarizes system-level metrics
      // including CPU time, memory, disk, and network. It also collects,
      // aggregates, and summarizes diagnostic information such as cold starts
      // and Lambda worker shutdowns to help you isolate issues with your Lambda
      // functions and resolve them quickly.
      // Ref: https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Lambda-Insights.html
      insightsVersion: aws_lambda.LambdaInsightsVersion.VERSION_1_0_333_0,
      // Logs
      logGroup: this.cdk.logGroup,
      loggingFormat: aws_lambda.LoggingFormat.JSON,
      applicationLogLevelV2: aws_lambda.ApplicationLogLevel.INFO,
      systemLogLevelV2: aws_lambda.SystemLogLevel.INFO,
      // Customization
      functionName: this.props.name,
      description: this.props.description,
      // Environment and Encryption
      environmentEncryption: this.props.encryption,
      environment: this.props.environment,
      // Function
      entry: this.props.file,
      handler: this.props.handler,
      // vpc
      vpc: this.props.vpc,
      vpcSubnets: this.props.vpcSubnets,
      allowPublicSubnet: false,
      // Bundling
      bundling: {
        minify: true,
        sourceMap: false,
        externalModules: ["@aws-sdk/*"],
      },
    });
  }

  private setupEncryption() {
    if (!this.props.encryption) return;

    // Setup encryption
    this.cdk.encryption = this.props.encryption;
    this.cdk.encryption.grantDecrypt(this.cdk.function);
  }
}
