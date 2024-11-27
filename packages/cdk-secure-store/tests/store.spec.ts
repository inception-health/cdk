import {
  App,
  Stack,
  aws_kms,
  aws_dynamodb,
  CfnElement,
  aws_iam,
} from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";

import { SecureStore } from "../lib/store";

describe("Secure Store", () => {
  let stack: Stack;
  let encryptionKey: aws_kms.IKey;

  const devOpsTopicArn = "arn:aws:sns:us-east-1:123456789012:topic";
  const tableName = "MyTable";

  beforeEach(() => {
    const app = new App();
    stack = new Stack(app, "TestStack", {
      env: {
        region: "us-east-1",
        account: "123456789012",
      },
    });
    encryptionKey = aws_kms.Key.fromKeyArn(
      stack,
      "MyKey",
      "arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012",
    );
  });

  // ======================
  // General
  // ======================
  describe("General Behavior", () => {
    it("should match the default snapshot", () => {
      new SecureStore(stack, "MySecureStore", {
        tableName,
        encryptionKey: encryptionKey,
      });

      // then
      expect(Template.fromStack(stack)).toMatchSnapshot();
    });

    it("should create a SecureStoreDB table with the specified name", () => {
      new SecureStore(stack, "MySecureStore", {
        tableName,
        encryptionKey: encryptionKey,
      });

      // then
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
        TableName: tableName,
      });
    });

    it("should create a DynamoDB table with the specified encryption key", () => {
      const keyArn = "arn:aws:kms:us-east-1:123456789012:key/12345678";
      const encryptionKey = aws_kms.Key.fromKeyArn(stack, "MyKey-2", keyArn);

      new SecureStore(stack, "TestDynamo", {
        tableName,
        partitionKey: {
          name: "id",
          type: aws_dynamodb.AttributeType.STRING,
        },
        encryptionKey: encryptionKey,
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
        SSESpecification: {
          SSEEnabled: true,
          SSEType: "KMS",
        },
        Replicas: [
          Match.objectLike({
            Region: "us-east-1",
            SSESpecification: {
              KMSMasterKeyId: keyArn,
            },
          }),
        ],
      });
    });

    it("it should have backups enabled", () => {
      // When
      const store = new SecureStore(stack, "MySecureStore", {
        tableName,
        encryptionKey: encryptionKey,
        // WHEN
        backupEnabled: true,
      });

      // Then
      expect(store.components.backup.cdk.backupPlan).toBeDefined();
      expect(store.components.backup.cdk.backupVault).toBeDefined();
      Template.fromStack(stack).resourceCountIs("AWS::Backup::BackupPlan", 1);
      Template.fromStack(stack).resourceCountIs("AWS::Backup::BackupVault", 1);
    });

    it("should have backup plan associated with the custom vault", () => {
      // When
      const store = new SecureStore(stack, "MySecureStore", {
        tableName,
        encryptionKey: encryptionKey,
        // WHEN
        backupEnabled: true,
      });

      // Then
      expect(store.components.backup.cdk.backupVault?.backupVaultArn).toBe(
        store.components.backup.cdk.backupVault?.backupVaultArn,
      );

      // Then
      const template = Template.fromStack(stack);

      const vaultName = stack.getLogicalId(
        store.components.backup.cdk.backupVault?.node
          .defaultChild as CfnElement,
      );

      template.hasResourceProperties("AWS::Backup::BackupPlan", {
        BackupPlan: {
          BackupPlanRule: Match.arrayEquals([
            {
              Lifecycle: {
                DeleteAfterDays: 35,
              },
              RuleName: "Daily",
              ScheduleExpression: "cron(0 5 * * ? *)",
              TargetBackupVault: {
                "Fn::GetAtt": [vaultName, "BackupVaultName"],
              },
            },
            {
              Lifecycle: {
                DeleteAfterDays: 90,
              },
              RuleName: "Weekly",
              ScheduleExpression: "cron(0 5 ? * SAT *)",
              TargetBackupVault: {
                "Fn::GetAtt": [vaultName, "BackupVaultName"],
              },
            },
            {
              Lifecycle: {
                DeleteAfterDays: 2555,
                MoveToColdStorageAfterDays: 90,
              },
              RuleName: "Monthly7Year",
              ScheduleExpression: "cron(0 5 1 * ? *)",
              TargetBackupVault: {
                "Fn::GetAtt": [vaultName, "BackupVaultName"],
              },
            },
          ]),
        },
      });
    });

    it("should have DevOps notifications when enabled", () => {
      // When
      const store = new SecureStore(stack, "MySecureStore", {
        tableName,
        encryptionKey: encryptionKey,
        devOpsTopicArn: devOpsTopicArn,
      });

      // Then
      expect(store.components.devops).toBeDefined();
      Template.fromStack(stack).resourceCountIs("AWS::Events::Rule", 1);
    });

    it("should have GSI when defined", () => {
      new SecureStore(stack, "MySecureStore", {
        tableName,
        encryptionKey: encryptionKey,
        // WHEN
        globalSecondaryIndexes: [
          {
            indexName: "MyGSI",
            partitionKey: {
              name: "id",
              type: aws_dynamodb.AttributeType.STRING,
            },
          },
        ],
      });

      // THEN
      Template.fromStack(stack).hasResourceProperties(
        "AWS::DynamoDB::GlobalTable",
        {
          GlobalSecondaryIndexes: [
            {
              IndexName: "MyGSI",
              KeySchema: [
                {
                  AttributeName: "id",
                  KeyType: "HASH",
                },
              ],
              Projection: {
                ProjectionType: "ALL",
              },
            },
          ],
        },
      );
    });

    it("should have LSI when defined", () => {
      new SecureStore(stack, "MySecureStore", {
        tableName,
        encryptionKey: encryptionKey,
        // WHEN
        localSecondaryIndexes: [
          {
            indexName: "MyGSI",
            sortKey: {
              name: "id",
              type: aws_dynamodb.AttributeType.STRING,
            },
          },
        ],
      });

      // THEN
      Template.fromStack(stack).hasResourceProperties(
        "AWS::DynamoDB::GlobalTable",
        {
          LocalSecondaryIndexes: [
            {
              IndexName: "MyGSI",
              KeySchema: [
                {
                  AttributeName: "PK",
                  KeyType: "HASH",
                },
                {
                  AttributeName: "id",
                  KeyType: "RANGE",
                },
              ],
              Projection: {
                ProjectionType: "ALL",
              },
            },
          ],
        },
      );
    });

    it("should raise exception when an encryption key is not specified", () => {
      // Given
      const devOpsTopicArn = "arn:aws:sns:us-east-1:123456789012:topic";
      const tableName = "MyTable";

      // When
      expect(() => {
        new SecureStore(stack, "MySecureStore", {
          tableName,
          devOpsTopicArn: devOpsTopicArn,
          // WHEN
          encryptionKey: undefined as any,
        });
      }).toThrowError("An encryption key is required for the table.");
    });

    it("should raise exception when a partition key is not specified", () => {
      // Given
      const devOpsTopicArn = "arn:aws:sns:us-east-1:123456789012:topic";
      const tableName = "MyTable";

      // When
      expect(() => {
        new SecureStore(stack, "MySecureStore", {
          tableName,
          encryptionKey: encryptionKey,
          devOpsTopicArn: devOpsTopicArn,
          // WHEN
          partitionKey: undefined as any,
        });
      }).toThrowError("The property partitionKey is required.");
    });
  });

  // ======================
  // Granting Permissions
  // ======================
  describe("Granting Permissions", () => {
    it("should grant read data permissions", () => {
      // Given
      const secureStore = new SecureStore(stack, "MySecureStore", {
        tableName,
        encryptionKey: encryptionKey,
      });
      const role = new aws_iam.Role(stack, "TestRole", {
        assumedBy: new aws_iam.ServicePrincipal("lambda.amazonaws.com"),
      });

      // WHEN
      secureStore.grantReadData(role);

      // Expect
      const logicalTableId = stack.getLogicalId(
        secureStore.cdk.table.node.defaultChild as CfnElement,
      );

      const logicalRoleId = stack.getLogicalId(
        role.node.defaultChild as CfnElement,
      );

      // THEN
      Template.fromStack(stack).hasResourceProperties("AWS::IAM::Policy", {
        PolicyDocument: {
          Statement: Match.arrayWith([
            {
              Action: ["kms:Decrypt", "kms:DescribeKey"],
              Effect: "Allow",
              Resource: encryptionKey.keyArn,
            },
            {
              Action: [
                "dynamodb:BatchGetItem",
                "dynamodb:GetRecords",
                "dynamodb:GetShardIterator",
                "dynamodb:Query",
                "dynamodb:GetItem",
                "dynamodb:Scan",
                "dynamodb:ConditionCheckItem",
                "dynamodb:DescribeTable",
              ],
              Effect: "Allow",
              Resource: [
                { "Fn::GetAtt": [logicalTableId, "Arn"] },

                {
                  "Fn::Join": [
                    "",
                    [{ "Fn::GetAtt": [logicalTableId, "Arn"] }, "/index/*"],
                  ],
                },
              ],
            },
          ]),
          Version: "2012-10-17",
        },
        Roles: [{ Ref: logicalRoleId }],
      });
    });

    it("should grant write data permissions", () => {
      // Given
      const secureStore = new SecureStore(stack, "MySecureStore", {
        tableName,
        encryptionKey: encryptionKey,
      });
      const role = new aws_iam.Role(stack, "TestRole", {
        assumedBy: new aws_iam.ServicePrincipal("lambda.amazonaws.com"),
      });

      // WHEN
      secureStore.grantWriteData(role);

      // Expect
      const logicalTableId = stack.getLogicalId(
        secureStore.cdk.table.node.defaultChild as CfnElement,
      );

      const logicalRoleId = stack.getLogicalId(
        role.node.defaultChild as CfnElement,
      );

      // THEN
      Template.fromStack(stack).hasResourceProperties("AWS::IAM::Policy", {
        PolicyDocument: {
          Statement: Match.arrayWith([
            {
              Action: [
                "kms:Decrypt",
                "kms:DescribeKey",
                "kms:Encrypt",
                "kms:ReEncrypt*",
                "kms:GenerateDataKey*",
              ],
              Effect: "Allow",
              Resource: encryptionKey.keyArn,
            },
            {
              Action: [
                "dynamodb:BatchWriteItem",
                "dynamodb:PutItem",
                "dynamodb:UpdateItem",
                "dynamodb:DeleteItem",
                "dynamodb:DescribeTable",
              ],
              Effect: "Allow",
              Resource: [
                { "Fn::GetAtt": [logicalTableId, "Arn"] },

                {
                  "Fn::Join": [
                    "",
                    [{ "Fn::GetAtt": [logicalTableId, "Arn"] }, "/index/*"],
                  ],
                },
              ],
            },
          ]),
          Version: "2012-10-17",
        },
        Roles: [{ Ref: logicalRoleId }],
      });
    });

    it("should grant read/write data permissions", () => {
      // Given
      const secureStore = new SecureStore(stack, "MySecureStore", {
        tableName,
        encryptionKey: encryptionKey,
      });
      const role = new aws_iam.Role(stack, "TestRole", {
        assumedBy: new aws_iam.ServicePrincipal("lambda.amazonaws.com"),
      });

      // WHEN
      secureStore.grantReadWriteData(role);

      // Expect
      const logicalTableId = stack.getLogicalId(
        secureStore.cdk.table.node.defaultChild as CfnElement,
      );

      const logicalRoleId = stack.getLogicalId(
        role.node.defaultChild as CfnElement,
      );

      // THEN
      Template.fromStack(stack).hasResourceProperties("AWS::IAM::Policy", {
        PolicyDocument: {
          Statement: Match.arrayWith([
            {
              Action: [
                "kms:Decrypt",
                "kms:DescribeKey",
                "kms:Encrypt",
                "kms:ReEncrypt*",
                "kms:GenerateDataKey*",
              ],
              Effect: "Allow",
              Resource: encryptionKey.keyArn,
            },
            {
              Action: [
                "dynamodb:BatchGetItem",
                "dynamodb:GetRecords",
                "dynamodb:GetShardIterator",
                "dynamodb:Query",
                "dynamodb:GetItem",
                "dynamodb:Scan",
                "dynamodb:ConditionCheckItem",
                "dynamodb:BatchWriteItem",
                "dynamodb:PutItem",
                "dynamodb:UpdateItem",
                "dynamodb:DeleteItem",
                "dynamodb:DescribeTable",
              ],
              Effect: "Allow",
              Resource: [
                { "Fn::GetAtt": [logicalTableId, "Arn"] },

                {
                  "Fn::Join": [
                    "",
                    [{ "Fn::GetAtt": [logicalTableId, "Arn"] }, "/index/*"],
                  ],
                },
              ],
            },
          ]),
          Version: "2012-10-17",
        },
        Roles: [{ Ref: logicalRoleId }],
      });
    });
  });
});
