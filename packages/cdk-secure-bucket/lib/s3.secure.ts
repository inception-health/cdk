import { aws_kms, aws_s3 } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

import { LifecycleMode } from "./lifecycle";

export interface SecureStoreProps
  extends Pick<aws_s3.BucketProps, "bucketName"> {
  /**
   * External KMS key to use for bucket encryption.
   *
   * The `encryption` property must be specified.
   *
   */
  encryptionKey: string;

  /**
   * Type of Bucket lifecycle to use.
   *
   * - Basic: simple basic lifecycle
   * - Intelligent: intelligent lifecycle
   * - None: no lifecycle (not recommended)
   *
   *@defaultValue BASIC
   */
  lifecycleMode?: LifecycleMode;

  /**
   * Bucket removal policy.
   *
   *@defaultValue RemovalPolicy.RETAIN
   */
  removalPolicy?: cdk.RemovalPolicy;
}

const defaultProps = {
  lifecycleMode: LifecycleMode.BASIC,
  removalPolicy: cdk.RemovalPolicy.RETAIN,
};

/**
 * A secure S3 Bucket that  follows Inception Health HIPAA policies
 *
 * References:
 * - https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html
 */
export class SecureBucket extends aws_s3.Bucket {
  private readonly props: SecureStoreProps;
  public readonly kmsKey: aws_kms.IKey;

  constructor(scope: Construct, id: string, props: SecureStoreProps) {
    const customKmsKey = aws_kms.Key.fromKeyArn(
      scope,
      `${id}-kms`,
      props.encryptionKey,
    );
    const config = Object.assign({}, defaultProps, props);

    // validation
    if (!config || !config.lifecycleMode)
      throw new Error("Construct requires default lifecycle");

    super(scope, id, {
      bucketName: props.bucketName,
      // ================================================
      // Lifecycle Management
      // ================================================
      lifecycleRules: config.lifecycleMode.rule
        ? [config.lifecycleMode.rule]
        : undefined,
      removalPolicy: config.removalPolicy,

      //autoDeleteObjects: false, // this is applicable only when removalPolicy` to be set to `RemovalPolicy.DESTROY`

      // ================================================
      // Inventory Management
      // ================================================
      // References:
      // - https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-inventory.html
      // inventories: ,

      // ================================================
      // Preventative Security Best Practices
      // ================================================
      // Step 1- Use Amazon S3 block public access.
      blockPublicAccess: aws_s3.BlockPublicAccess.BLOCK_ALL,
      // Step 2- Encryption
      encryption: aws_s3.BucketEncryption.KMS,
      // S3 Bucket Keys decrease the request traffic from Amazon S3 to AWS Key Management Service (AWS KMS) and reduce the cost of SSE-KMS
      // https://docs.aws.amazon.com/AmazonS3/latest/userguide/bucket-key.html
      bucketKeyEnabled: true,
      encryptionKey: customKmsKey,
      // Step 3 - Enforce encryption of data in transit
      enforceSSL: true,
      // Step 4 - Versioning
      // Versioning is a means of keeping multiple variants of an object in the same bucket.
      // You can use versioning to preserve, retrieve, and restore every version of every
      // object stored in your Amazon S3 bucket. With versioning, you can easily recover
      // from both unintended user actions and application failures.
      // TODO: Also consider implementing on-going detective controls using
      // the s3-bucket-versioning-enabled managed AWS Config rule.
      versioned: true,

      // Step 5 - Cross-region replication
      // TODO: Consider Amazon S3 cross-region replication

      // Step 6 - VPC endpoints for Amazon S3 access
      //
      // TODO: Consider VPC endpoints for Amazon S3 access VPC endpoints for
      // Amazon S3 provide multiple ways to control access to your Amazon S3
      // data:
      // - You can control the requests, users, or groups that are allowed
      //   through a specific VPC endpoint.
      // - You can control which VPCs or VPC endpoints have access to your S3
      //   buckets by using S3 bucket policies.
      // - You can help prevent data exfiltration by using a VPC that does not
      //   have an internet gateway.

      // ================================================
      // Monitoring and Auditing Best Practices
      // ================================================
      // Step 1 - Identify and audit all your Amazon S3 buckets

      // Step 3 - Enable Amazon S3 server access logging
      // TODO: should we build a custom s3 access log destination
      serverAccessLogsPrefix: "accesslogs",
    });

    // ================================================
    // Monitoring and Auditing Best Practices
    // ================================================
    // Step 2 - Implement monitoring using AWS monitoring tools
    // Monitoring is an important part of maintaining the reliability,
    // security, availability, and performance of Amazon S3 and your AWS
    // solutions. AWS provides several tools and services to help you
    // monitor Amazon S3 and your other AWS services. For example, you can
    // monitor CloudWatch metrics for Amazon S3, particularly PutRequests,
    // GetRequests, 4xxErrors, and DeleteRequests. For more information, see
    // Monitoring metrics with Amazon CloudWatch and, Monitoring Amazon S3.
    // For a second example, see Example: Amazon S3 Bucket Activity. This
    // example describes how to create an Amazon CloudWatch alarm that is
    // triggered when an Amazon S3 API call is made to PUT or DELETE bucket
    // policy, bucket lifecycle, or bucket replication, or to PUT a bucket ACL.
    // const putRequestMetric = this.mm({ id: 'PutRequests' });
    // putRequestMetric.

    // Step 4 - Use AWS CloudTrail

    // Step 5 - Enable AWS Config

    // Step 6 - Consider using Amazon Macie with Amazon S3

    // Step 7 - Monitor AWS security advisories

    // ================================================
    // Props
    // ================================================
    this.props = config;
    this.kmsKey = customKmsKey;
  }
}
