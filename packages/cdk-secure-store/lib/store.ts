import {
  aws_dynamodb,
  aws_kms,
  aws_cloudwatch,
  aws_iam,
  Annotations,
} from "aws-cdk-lib";
import { Construct } from "constructs";

import { SecureStoreAlarms } from "./alarm";
import { SecureStoreBackup } from "./backup";
import { SecureStoreNotification } from "./notification";

// DynamoDB Constants
const DB_PK = "PK";
const DB_SK = "SK";
const DB_GSI1_INDEX = "GSI1";
const DB_GSI1_PARTITION_KEY = "GSI1PK";
const DB_GSI1_SORT_KEY = "GSI1SK";

export interface SecureStoreProps
  extends Required<Pick<aws_dynamodb.TablePropsV2, "tableName">>,
    Partial<
      Pick<
        aws_dynamodb.TablePropsV2,
        | "partitionKey"
        | "sortKey"
        | "timeToLiveAttribute"
        | "removalPolicy"
        | "globalSecondaryIndexes"
        | "localSecondaryIndexes"
      >
    > {
  /**
   * AWS Backup for the DynamoDB table.
   *
   * @remarks
   * This setting should be enabled for all production tables. For development,
   * you can disable it to save costs.
   *
   *@defaultValue true
   */
  backupEnabled?: boolean;

  /**
   * The SNS topic to send DevOps notifications to. The SNS topic must be
   * created in the same account and region as the DynamoDB table.
   */
  devOpsTopicArn?: string;

  /**
   * The encryption key to use for the DynamoDB table. The key is also used for
   * encrypting the backups, the logs, and the SNS topic for the DevOps
   * notifications.
   *
   * @remarks
   * The KMS Key must have the following policy attached to it. If the policies
   * are not attached, the EventBridge rule will not be able to send the
   * notifications to the SNS topic.
   * ```
   * {
   *       "Sid": "Allow access to CloudWatch Log",
   *       "Effect": "Allow",
   *       "Principal": {
   *           "Service": "logs.REGION.amazonaws.com"
   *       },
   *       "Action": [
   *           "kms:Encrypt",
   *           "kms:Decrypt",
   *           "kms:ReEncrypt*",
   *           "kms:GenerateDataKey*",
   *           "kms:DescribeKey"
   *       ],
   *       "Resource": "*",
   *       "Condition": {
   *           "ArnLike": {
   *               "kms:EncryptionContext:aws:logs:arn": "arn:aws:logs:REGION:ACCOUNT_ID:*"
   *           }
   *       }
   *   },
   *   {
   *       "Sid": "Allow access to EventBridge",
   *       "Effect": "Allow",
   *       "Principal": {
   *           "Service": "events.amazonaws.com"
   *       },
   *       "Action": [
   *           "kms:Encrypt",
   *           "kms:Decrypt",
   *           "kms:ReEncrypt*",
   *           "kms:GenerateDataKey*",
   *           "kms:DescribeKey"
   *       ],
   *       "Resource": "*"
   *   }
   * ```
   */
  encryptionKey: aws_kms.IKey;
}

const defaultProps: Partial<SecureStoreProps> = {
  backupEnabled: true,
  partitionKey: {
    name: DB_PK,
    type: aws_dynamodb.AttributeType.STRING,
  },
  sortKey: {
    name: DB_SK,
    type: aws_dynamodb.AttributeType.STRING,
  },
  globalSecondaryIndexes: [
    {
      indexName: DB_GSI1_INDEX,
      partitionKey: {
        name: DB_GSI1_PARTITION_KEY,
        type: aws_dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: DB_GSI1_SORT_KEY,
        type: aws_dynamodb.AttributeType.STRING,
      },
    },
  ],
};

interface SecureStoreResources {
  /**
   * The CloudWatch alarms created by this construct
   */
  alarms: aws_cloudwatch.Alarm[];
  /**
   * The DynamoDB table created by this construct
   */
  table: aws_dynamodb.TableV2;
  /**
   * The encryption key used for the DynamoDB table
   */
  tableEncryptionKey: aws_dynamodb.TableEncryptionV2;
}

interface SecureStoreComponents {
  alarms: SecureStoreAlarms;
  backup: SecureStoreBackup;
  devops: SecureStoreNotification;
}

/**
 * `SecureStore` is a construct that creates a secure DynamoDB table conformant
 * to Inception Health HIPAA.
 *
 * The table is encrypted using the provided KMS key.
 *
 * The billing mode is set to on-demand.
 *
 * The table name is required, while the partition key and sort key are
 * optional. If not provided, the partition key defaults to a string attribute
 * named "PK". The sort key defaults to a string attribute named "SK".
 *
 * The created resources, including the DynamoDB table and the encryption key,
 * are accessible through the `cdk` attribute.
 *
 * By default, we enable point-in-time recovery. It can restore to any point in
 * time within `EarliestRestorableDateTime` an `LatestRestorableDateTime`.
 * `LatestRestorableDateTime` is typically 5 minutes before the current time.
 *
 * @remarks
 * We do not support multiple replication regions yet. This requires an extra
 * cost and our current stand is that we do not need it for HIPAA or for load
 * balancing.
 *
 * @remarks
 * For Disaster Recovery, we use AWS Backup. This is a managed service that
 * allows us to restore the table to any point in time within the last 7 years.
 *
 * For our Runbook, please read:
 * TODO: Add link to runbook
 *
 * @todo
 * - Schema evolution.
 */
export class SecureStore extends Construct {
  // !Readonly Attributes
  /**
   * A container for the cdk resources created by this construct
   */
  public readonly cdk: SecureStoreResources;

  /**
   * A container for the components created by this construct.
   */
  public readonly components: SecureStoreComponents;

  // !Private Attributes
  private readonly props: SecureStoreProps;

  constructor(scope: Construct, id: string, props: SecureStoreProps) {
    super(scope, id);

    // Initialize the properties
    this.props = { ...defaultProps, ...props };
    this.components = {} as SecureStoreComponents;
    this.cdk = {} as SecureStoreResources;

    // Important: the order of this setup is important. If placed in this
    // sequence, there is a limitation where we update the table name and the
    // rule is updated with the new name. In case, we delete the old table, the
    // rule will not trigger anymore for the old table. However, in this setup,
    // if we change the table name, the monitoring will be triggered for the new
    // table name. We decided that this is the preferred behavior.
    this.setupDevOps();

    this.setupTableEncryption();
    this.setupDynamoTable();

    // Add backup
    this.setupBackup();

    // Add alerting
    this.setupAlarms();

    // Add annotations
    this.annotations();
  }

  // !Public
  /**
   * Permits an IAM principal all data read operations on this table.
   *
   * Actions: BatchGetItem, GetRecords, GetShardIterator, Query, GetItem, Scan, DescribeTable.
   *
   * Note: Appropriate grants will also be added to the customer-managed KMS keys associated with this
   * table if one was configured.
   *
   * @param grantee the principal to grant access to
   */
  public grantReadData(grantee: aws_iam.IGrantable): aws_iam.Grant {
    return this.cdk.table.grantReadData(grantee);
  }
  /**
   * Permits an IAM principal all data write operations on this table.
   *
   * Actions: BatchWriteItem, PutItem, UpdateItem, DeleteItem, DescribeTable.
   *
   * Note: Appropriate grants will also be added to the customer-managed KMS keys associated with this
   * table if one was configured.
   *
   * @param grantee the principal to grant access to
   */
  grantWriteData(grantee: aws_iam.IGrantable): aws_iam.Grant {
    return this.cdk.table.grantWriteData(grantee);
  }
  /**
   * Permits an IAM principal to all data read/write operations on this table.
   *
   * Actions: BatchGetItem, GetRecords, GetShardIterator, Query, GetItem, Scan, BatchWriteItem, PutItem, UpdateItem,
   * DeleteItem, DescribeTable.
   *
   * Note: Appropriate grants will also be added to the customer-managed KMS keys associated with this
   * table if one was configured.
   *
   * @param grantee the principal to grant access to
   */
  grantReadWriteData(grantee: aws_iam.IGrantable): aws_iam.Grant {
    return this.cdk.table.grantReadWriteData(grantee);
  }

  addWidgetsToDashboard(dashboard: aws_cloudwatch.Dashboard) {
    dashboard.addWidgets(...this.components.alarms.cdk.widgets);
  }

  // !Private setup
  private setupDevOps() {
    if (!this.props.devOpsTopicArn) return;

    this.components.devops = new SecureStoreNotification(this, "devops", {
      destination: this.props.devOpsTopicArn,
      sourceTable: this.props.tableName,
      encryptionKey: this.props.encryptionKey,
      enableLogs: true,
    });
  }

  private setupTableEncryption() {
    if (!this.props.encryptionKey)
      throw new Error("An encryption key is required for the table.");

    this.cdk.tableEncryptionKey =
      aws_dynamodb.TableEncryptionV2.customerManagedKey(
        this.props.encryptionKey,
      );
  }

  private setupDynamoTable() {
    if (!this.props.partitionKey)
      throw new Error("The property partitionKey is required.");

    this.cdk.table = new aws_dynamodb.TableV2(this, "table", {
      // Default values
      pointInTimeRecovery: true,
      contributorInsights: true,
      deletionProtection: true,
      billing: aws_dynamodb.Billing.onDemand(),
      // Props values
      encryption: this.cdk.tableEncryptionKey,
      tableName: this.props.tableName,
      partitionKey: this.props.partitionKey,
      sortKey: this.props.sortKey,
      localSecondaryIndexes: this.props.localSecondaryIndexes,
      globalSecondaryIndexes: this.props.globalSecondaryIndexes,
    });
  }

  private setupBackup() {
    if (!this.props.backupEnabled) return;

    this.components.backup = new SecureStoreBackup(this, "backup", {
      tableName: this.props.tableName,
      table: this.cdk.table,
      encryptionKey: this.props.encryptionKey,
    });
  }

  private setupAlarms() {
    this.components.alarms = new SecureStoreAlarms(this, "alarms", {
      devOpsTopicArn: this.props.devOpsTopicArn,
    });
  }

  private annotations() {
    Annotations.of(this).addWarning(
      "This is still a beta version. Please use with caution.",
    );

    if (!this.props.backupEnabled) {
      Annotations.of(this).addWarning(
        "Backup is disabled. This is not recommended for production.",
      );
    }
  }
}
