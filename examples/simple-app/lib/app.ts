#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import "dotenv/config";
import { HIPAASecurityChecks } from "cdk-nag";

import { ExampleSecureStack } from "./stack";

const app = new cdk.App();
new ExampleSecureStack(app, "ExampleStack", {
  env: {
    region: "us-east-1",
  },
});

cdk.Aspects.of(app).add(new HIPAASecurityChecks({ verbose: true }));

app.synth();
