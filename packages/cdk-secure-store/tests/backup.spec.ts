import { Stack, aws_dynamodb, aws_kms } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";

import { SecureStoreBackup } from "../lib/backup";
import { SecureStore } from "../lib/store";

describe("Backup", () => {
  let stack: Stack;

  beforeEach(() => {
    stack = new Stack(undefined, "test", {
      env: {
        region: "us-west-1",
        account: "123456789012",
      },
    });
  });

  it("creates a backup plan if no backupPlanId is provided", () => {
    // Given
    new SecureStore(stack, "SecureStore", {
      tableName: "my-table",
      encryptionKey: aws_kms.Key.fromKeyArn(
        stack,
        "key",
        "arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012",
      ),
      backupEnabled: true,
    });

    // Then
    expect(Template.fromStack(stack)).toMatchSnapshot();
    Template.fromStack(stack).resourceCountIs("AWS::Backup::BackupPlan", 1);
    Template.fromStack(stack).resourceCountIs("AWS::Backup::BackupVault", 1);
  });

  it("uses an existing backup plan if backupPlanId is provided", () => {
    const backupPlanId = "my-backup-plan-id";
    const table = aws_dynamodb.TableV2.fromTableName(
      stack,
      "Table",
      "my-table",
    );

    const backup = new SecureStoreBackup(stack, "SecureStoreBackup", {
      backupPlanId,
      table: table,
      tableName: "my-table",
      encryptionKey: aws_kms.Key.fromKeyArn(
        stack,
        "key",
        "arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012",
      ),
    });

    // TODO: Add assertion to check that the existing backup plan is used
    Template.fromStack(stack).resourceCountIs("AWS::Backup::BackupPlan", 0);
    expect(backup.cdk.backupPlan?.backupPlanId).toEqual(backupPlanId);
  });
});
