import path from "path";

import { Stack, StackProps, aws_kms, aws_sns, aws_ec2 } from "aws-cdk-lib";
import { Construct } from "constructs";

import { Lambda, StandardNetwork } from "@inception-health/cdk-lambda";
import { SecureStore } from "@inception-health/cdk-secure-store";

export class ExampleSecureStack extends Stack {
  public readonly cdk: {
    key: aws_kms.IKey;
    lambda: Lambda;
    store: SecureStore;
    topic: aws_sns.ITopic;
  };

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    this.cdk = {} as any;

    // !Create Resources
    // ======================
    // Resources
    // ======================
    this.cdk.key = new aws_kms.Key(this, "Key", {
      alias: "app-test-key",
      description: "Key for the Test App",
    });
    this.cdk.topic = new aws_sns.Topic(this, "Topic", {
      enforceSSL: true,
      masterKey: this.cdk.key,
      topicName: "devops-topic",
      displayName: "DevOps Topic for Example App",
    });

    // ======================
    // Networking
    // ======================
    const network = new StandardNetwork(this, "TestVpc", {
      name: "TestVpc",
      encryption: this.cdk.key,
    });

    // ======================
    // Secure Store
    // ======================
    this.cdk.store = new SecureStore(this, "SecureStore", {
      tableName: "test-table-3",
      encryptionKey: this.cdk.key,
      backupEnabled: true,
      alertsTopic: this.cdk.topic.topicArn,
    });

    // ======================
    // Lambda
    // ======================
    this.cdk.lambda = new Lambda(this, "Lambda", {
      name: "hello-world",
      file: path.join(__dirname, "../src/handler.ts"),
      encryption: this.cdk.key,
      vpc: network.vpc,
      vpcSubnets: network.vpc.selectSubnets({
        subnetType: aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
      }),
    });

    this.cdk.lambda.addEnvironment(
      "TABLE_NAME",
      this.cdk.store.cdk.table.tableName,
    );
    this.cdk.store.grantReadWriteData(this.cdk.lambda);
  }
}
