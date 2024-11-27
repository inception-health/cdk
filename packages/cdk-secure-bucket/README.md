# @inception-health/cdk-secure-bucket

Provides a construct that extends an s3 bucket. This is different than a lot of our constructs that wrap aws resources.

This bucket implementation handles security best practices. Use can use it instead of a standard s3 bucket by default but you must use it if you're storing PII/PHI.