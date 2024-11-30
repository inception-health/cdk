import * as crypto from "crypto";

import { Stack, App } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import { Match, Template, Annotations } from "aws-cdk-lib/assertions";
import { HIPAASecurityChecks } from "cdk-nag";

import { LifecycleMode } from "../lib/lifecycle";
import { SecureBucket } from "../lib/s3.secure";

describe("Secure S3 Store", () => {
  it("should conform to a basic snapshot", async () => {
    // GIVEN
    const stack = new Stack();
    const kmsArn = "arn:aws:kms:us-east-1:123454:key/general";
    new SecureBucket(stack, "test-secure-store", { encryptionKey: kmsArn });

    // THEN
    expect(Template.fromStack(stack)).toMatchSnapshot();
  });

  it.skip("should pass cdk-nag HIPAASecurityChecks configuration", async () => {
    // GIVEN
    const app = new App();
    const stack = new Stack(app);
    cdk.Aspects.of(stack).add(new HIPAASecurityChecks({ verbose: true }));
    const kmsArn = "arn:aws:kms:us-east-1:123454:key/general";

    // WHEN
    new SecureBucket(stack, "test-secure-store", { encryptionKey: kmsArn });

    app.synth();

    // THEN
    const errors = Annotations.fromStack(stack).findError(
      "*",
      Match.stringLikeRegexp("HIPAA.*"),
    );
    expect(errors).toHaveLength(0);

    const warnings = Annotations.fromStack(stack).findWarning(
      "*",
      Match.stringLikeRegexp("HIPAA.*"),
    );
    expect(warnings).toHaveLength(0);
  });

  it("should allow configuration of the bucket name", async () => {
    // GIVEN
    const stack = new Stack();
    const customBucketName = `custom-${crypto.randomUUID()}`;
    const customKmsArn = "arn:aws:kms:us-east-1:123454:key/general";
    new SecureBucket(stack, "test-secure-store", {
      encryptionKey: customKmsArn,
      bucketName: customBucketName,
    });

    // THEN
    Template.fromStack(stack).hasResourceProperties("AWS::S3::Bucket", {
      BucketName: customBucketName,
    });
  });

  it("should have versioning enabled by default", async () => {
    // GIVEN
    const stack = new Stack();
    const customBucketName = `custom-${crypto.randomUUID()}`;
    const customKmsArn = "arn:aws:kms:us-east-1:123454:key/general";
    new SecureBucket(stack, "test-secure-store", {
      encryptionKey: customKmsArn,
      bucketName: customBucketName,
    });

    // THEN
    Template.fromStack(stack).hasResourceProperties("AWS::S3::Bucket", {
      VersioningConfiguration: {
        Status: "Enabled",
      },
    });
  });

  it("should replace type of lifecycle to intelligent", async () => {
    // GIVEN
    const stack = new Stack();
    const customBucketName = `custom-${crypto.randomUUID()}`;
    const customKmsArn = "arn:aws:kms:us-east-1:123454:key/general";
    new SecureBucket(stack, "test-secure-store", {
      encryptionKey: customKmsArn,
      bucketName: customBucketName,
      lifecycleMode: LifecycleMode.INTELLIGENT,
    });

    // THEN
    Template.fromStack(stack).hasResourceProperties("AWS::S3::Bucket", {
      LifecycleConfiguration: {
        Rules: [
          {
            Status: "Enabled",
            Transitions: [
              {
                StorageClass: "INTELLIGENT_TIERING",
                TransitionInDays: 360,
              },
              {
                StorageClass: "GLACIER",
                TransitionInDays: 1080,
              },
            ],
          },
        ],
      },
    });
  });

  it("should replace type of lifecycle to NONE", async () => {
    // GIVEN
    const stack = new Stack();
    const customBucketName = `custom-${crypto.randomUUID()}`;
    const customKmsArn = "arn:aws:kms:us-east-1:123454:key/general";
    new SecureBucket(stack, "test-secure-store", {
      encryptionKey: customKmsArn,
      bucketName: customBucketName,
      lifecycleMode: LifecycleMode.NONE,
    });

    // THEN
    Template.fromStack(stack).hasResourceProperties("AWS::S3::Bucket", {
      LifecycleConfiguration: Match.absent(),
    });
  });

  it("should configure removal policy to DESTROY", async () => {
    // GIVEN
    const stack = new Stack();
    const customBucketName = `custom-${crypto.randomUUID()}`;
    const customKmsArn = "arn:aws:kms:us-east-1:123454:key/general";
    new SecureBucket(stack, "test-secure-store", {
      encryptionKey: customKmsArn,
      bucketName: customBucketName,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // THEN
    Template.fromStack(stack).hasResource("AWS::S3::Bucket", {
      DeletionPolicy: "Delete",
    });
  });
});
