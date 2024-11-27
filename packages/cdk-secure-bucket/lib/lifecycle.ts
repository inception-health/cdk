import { aws_s3, Duration } from "aws-cdk-lib";

// The lifecycle policy for items should be managed cohesively
export class LifecycleMode {
  static readonly NONE = new LifecycleMode();

  static readonly BASIC = new LifecycleMode({
    enabled: true,
    transitions: [
      {
        storageClass: aws_s3.StorageClass.INFREQUENT_ACCESS,
        transitionAfter: Duration.days(360),
      },
      {
        storageClass: aws_s3.StorageClass.GLACIER,
        transitionAfter: Duration.days(360 * 3),
      },
    ],
  });

  static readonly INTELLIGENT = new LifecycleMode({
    enabled: true,
    transitions: [
      {
        storageClass: aws_s3.StorageClass.INTELLIGENT_TIERING,
        transitionAfter: Duration.days(360),
      },
      {
        storageClass: aws_s3.StorageClass.GLACIER,
        transitionAfter: Duration.days(360 * 3),
      },
    ],
  });

  private constructor(public readonly rule?: aws_s3.LifecycleRule) {}
}
