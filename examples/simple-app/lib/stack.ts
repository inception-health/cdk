import path from "path";

import { Stack, StackProps, aws_kms } from "aws-cdk-lib";
import { Construct } from "constructs";

import { Lambda } from "@inception-health/cdk-lambda";
import { SecureStore } from "@inception-health/cdk-secure-store";

export class ExampleSecureStack extends Stack {
  public readonly cdk: {
    key: aws_kms.IKey;
    lambda: Lambda;
    store: SecureStore;
  };

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    this.cdk = {} as any;

    // !Create Resources
    // ======================
    // Encryption Key
    // ======================
    this.cdk.key = new aws_kms.Key(this, "Key");

    // ======================
    // Secure Store
    // ======================
    this.cdk.store = new SecureStore(this, "SecureStore", {
      tableName: "test-table",
      encryptionKey: this.cdk.key,
      backupEnabled: true,
    });

    // ======================
    // Lambda
    // ======================
    this.cdk.lambda = new Lambda(this, "Lambda", {
      name: "hello-world",
      file: path.join(__dirname, "../src/handler.ts"),
    });
  }
}
