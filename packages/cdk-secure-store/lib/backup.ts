import { aws_backup, aws_dynamodb, aws_kms } from "aws-cdk-lib";
import { Construct } from "constructs";

export interface SecureStoreBackupProps {
  backupPlanId?: string;
  encryptionKey: aws_kms.IKey;
  table: aws_dynamodb.ITableV2;
  tableName: string;
}

export interface SecureStoreBackupResources {
  backupPlan: aws_backup.IBackupPlan | undefined;
  backupVault: aws_backup.BackupVault | undefined;
}

export class SecureStoreBackup extends Construct {
  public readonly cdk: SecureStoreBackupResources;

  private readonly props: SecureStoreBackupProps;

  constructor(scope: Construct, id: string, props: SecureStoreBackupProps) {
    super(scope, id);

    // Initialize the properties
    this.props = props;
    this.cdk = {} as SecureStoreBackupResources;

    // Create the backup resources
    if (this.props.backupPlanId) {
      this.cdk.backupPlan = aws_backup.BackupPlan.fromBackupPlanId(
        this,
        "backupPlan",
        this.props.backupPlanId,
      );
    } else {
      // Create a backup vault
      this.cdk.backupVault = new aws_backup.BackupVault(this, "backupVault", {
        backupVaultName: `secure-store-${this.props.tableName}-backup-vault`,
        encryptionKey: this.props.encryptionKey,
        blockRecoveryPointDeletion: true,
        // TODO: Review if we want to make lock configuration by default.
        // lockConfiguration
      });

      // Create the backup plan
      this.cdk.backupPlan =
        aws_backup.BackupPlan.dailyWeeklyMonthly7YearRetention(
          this,
          `secure-store-${this.props.tableName}-backup-plan`,
          this.cdk.backupVault,
        );

      (this.cdk.backupPlan as aws_backup.BackupPlan).addSelection(
        `secure-store-${this.props.tableName}-backup-plan-selection`,
        {
          resources: [
            aws_backup.BackupResource.fromDynamoDbTable(this.props.table),
          ],
        },
      );
    }
  }
}
