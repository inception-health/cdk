import * as cdk from "aws-cdk-lib";
import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";

import { StandardNetwork } from "../../lib/network/network";

describe("StandardVpc", () => {
  let app: App;
  let stack: cdk.Stack;
  let template: Template;
  let vpc: StandardNetwork;
  let key: cdk.aws_kms.IKey;

  beforeEach(() => {
    app = new App();
    stack = new cdk.Stack(app, "TestStack");
    key = new cdk.aws_kms.Key(stack, "Key");
    vpc = new StandardNetwork(stack, "TestVpc", {
      name: "TestVpc",
      encryption: key,
    });
    template = Template.fromStack(stack);
  });

  test("Matches the Snapshot", () => {
    // THEN
    expect(template).toMatchSnapshot();
  });

  test("VPC is created with correct properties", () => {
    template.hasResourceProperties("AWS::EC2::VPC", {
      CidrBlock: "10.0.0.0/16",
      EnableDnsSupport: true,
      EnableDnsHostnames: true,
    });
  });

  test("VPC has 6 subnets with correct configuration", () => {
    template.resourceCountIs("AWS::EC2::Subnet", 6);
    // Public subnets
    template.hasResourceProperties("AWS::EC2::Subnet", {
      CidrBlock: "10.0.0.0/24",
      MapPublicIpOnLaunch: false,
    });
    template.hasResourceProperties("AWS::EC2::Subnet", {
      CidrBlock: "10.0.1.0/24",
      MapPublicIpOnLaunch: false,
    });

    // Private subnets
    template.hasResourceProperties("AWS::EC2::Subnet", {
      CidrBlock: "10.0.2.0/24",
      MapPublicIpOnLaunch: false,
    });
    template.hasResourceProperties("AWS::EC2::Subnet", {
      CidrBlock: "10.0.3.0/24",
      MapPublicIpOnLaunch: false,
    });

    // Isolated subnets
    template.hasResourceProperties("AWS::EC2::Subnet", {
      CidrBlock: "10.0.4.0/28",
      MapPublicIpOnLaunch: false,
    });
    template.hasResourceProperties("AWS::EC2::Subnet", {
      CidrBlock: "10.0.4.16/28",
      MapPublicIpOnLaunch: false,
    });
  });

  test("Security group for Lambda is created with correct properties", () => {
    const vpcIdRef = stack.getLogicalId(
      vpc.cdk.vpc.node.defaultChild as cdk.CfnElement,
    );

    template.hasResourceProperties("AWS::EC2::SecurityGroup", {
      GroupDescription: "Security group for Lambda function",
      VpcId: {
        Ref: vpcIdRef,
      },
    });
  });

  test("Security group allows inbound HTTP and HTTPS traffic", () => {
    template.hasResourceProperties("AWS::EC2::SecurityGroup", {
      SecurityGroupIngress: [
        {
          CidrIp: "0.0.0.0/0",
          Description: "Allow HTTPS traffic",
          FromPort: 443,
          IpProtocol: "tcp",
          ToPort: 443,
        },
        {
          CidrIp: "0.0.0.0/0",
          Description: "Allow HTTP traffic",
          FromPort: 80,
          IpProtocol: "tcp",
          ToPort: 80,
        },
      ],
    });
  });

  test("Flow log group is created with correct properties", () => {
    const vpcIdRef = stack.getLogicalId(
      vpc.cdk.vpc.node.defaultChild as cdk.CfnElement,
    );

    template.hasResourceProperties("AWS::Logs::LogGroup", {
      LogGroupName: {
        "Fn::Join": [
          "",
          [
            "/aws/vpc/flow-logs/",
            {
              Ref: vpcIdRef,
            },
          ],
        ],
      },
      RetentionInDays: 30,
    });
  });
});
