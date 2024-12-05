import * as cdk from "aws-cdk-lib";
import {
  Vpc,
  SubnetType,
  SecurityGroup,
  Peer,
  Port,
  IVpc,
  ISecurityGroup,
  FlowLog,
  FlowLogTrafficType,
  FlowLogDestination,
} from "aws-cdk-lib/aws-ec2";
import { ILogGroup } from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

import { Lambda } from "../lambda";

export interface StandardNetworkProps {
  encryption: cdk.aws_kms.IKey;
  maxAzs?: number;
  name?: string;
}

export interface StandardNetworkCdk {
  flowLogGroup: ILogGroup;
  flowLogRole: cdk.aws_iam.IRole;
  flowLogs: FlowLog;
  lambdaSecurityGroup: ISecurityGroup;
  vpc: IVpc;
}

const defaultProps: Partial<StandardNetworkProps> = {
  // Ensure high availability by spreading across 3 availability zones
  maxAzs: 3,
};

export class StandardNetwork extends Construct {
  public readonly cdk: StandardNetworkCdk;

  private readonly props: StandardNetworkProps;

  constructor(scope: Construct, id: string, props?: StandardNetworkProps) {
    super(scope, id);

    // Initialize the properties
    this.cdk = {} as StandardNetworkCdk;
    this.props = Object.assign({}, defaultProps, props);

    // Create the VPC
    this.cdk.vpc = new Vpc(this, "vpc", {
      maxAzs: this.props.maxAzs,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "PublicSubnet",
          subnetType: SubnetType.PUBLIC,
          // (Control IDs: 164.308(a)(3)(i), 164.308(a)(4)(ii)(A),
          // 164.308(a)(4)(ii)(C), 164.312(a)(1), 164.312(e)(1)). Manage access
          // to the AWS Cloud by ensuring Amazon Virtual Private Cloud (VPC)
          // subnets are not automatically assigned a public IP address.
          mapPublicIpOnLaunch: false,
        },
        {
          cidrMask: 24,
          name: "PrivateSubnet",
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 28,
          name: "IsolatedSubnet",
          subnetType: SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // Create a security group for the Lambda function
    this.cdk.lambdaSecurityGroup = new SecurityGroup(
      this,
      "LambdaSecurityGroup",
      {
        vpc: this.cdk.vpc,
        description: "Security group for Lambda function",
        allowAllOutbound: true,
      },
    );

    // Restrict inbound traffic to the security group
    this.cdk.lambdaSecurityGroup.addIngressRule(
      Peer.anyIpv4(),
      Port.tcp(443),
      "Allow HTTPS traffic",
    );
    this.cdk.lambdaSecurityGroup.addIngressRule(
      Peer.anyIpv4(),
      Port.tcp(80),
      "Allow HTTP traffic",
    );

    // Create a log group for the VPC flow logs
    this.cdk.flowLogGroup = new cdk.aws_logs.LogGroup(this, "FlowLogGroup", {
      logGroupName: `/aws/vpc/flow-logs/${this.cdk.vpc.vpcId}`,
      retention: cdk.aws_logs.RetentionDays.ONE_MONTH,
      encryptionKey: this.props.encryption,
    });

    // Create a flow log for the VPC
    this.cdk.flowLogs = this.cdk.vpc.addFlowLog("FlowLog", {
      trafficType: FlowLogTrafficType.ALL,
      destination: FlowLogDestination.toCloudWatchLogs(this.cdk.flowLogGroup),
    });

    // Output the VPC ID and security group ID
    new cdk.CfnOutput(this, "VpcId", {
      value: this.cdk.vpc.vpcId,
    });

    new cdk.CfnOutput(this, "LambdaSecurityGroupId", {
      value: this.cdk.lambdaSecurityGroup.securityGroupId,
    });
  }

  public get vpc(): IVpc {
    return this.cdk.vpc;
  }

  public get lambdaSecurityGroup(): ISecurityGroup {
    return this.cdk.lambdaSecurityGroup;
  }

  public attachLambda(lambda: Lambda) {
    // lambda.cdk.function.connections.allowTo(
    //   this.cdk.lambdaSecurityGroup,
    //   Port.allTraffic(),
    //   "Allow Lambda to access resources in the VPC",
    // );
  }
}
