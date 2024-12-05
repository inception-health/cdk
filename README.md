# Inception Health CDK Constructs

Welcome to Inception Health CDK Constructs, a collection of opinionated AWS CDK constructs designed to help you build secure, compliant, and scalable applications on AWS with ease.

With a focus on **HIPAA compliance** and **security best practices**, this library enables developers to streamline infrastructure management, allowing teams to focus on building impactful applications without worrying about complex cloud configurations.

## Why Inception Health CDK Constructs?

At [Inception Health](https://inceptionhealth.io), we recognize the challenges of securely building and scaling healthcare applications on the cloud. Our AWS CDK constructs encapsulate the expertise and lessons learned from building healthcare solutions, ensuring that security, compliance, and scalability are baked into every application from the start.

### Key Features

  - AWS Native: Deep integration with AWS services and native tools.
  - HIPAA Compliance: Built with healthcare and regulatory standards in mind.
  - TypeScript-Based: Infrastructure-as-Code with a developer-friendly language.
  - Opinionated Design: Simplifies AWS APIs, allowing teams to focus on product development.

## Constructs

### SecureBucket

The `@inception-health/cdk-secure-bucket` package provides an enhanced S3 bucket construct with security best practices built-in. It is tailored for storing sensitive information, such as PII or PHI, and adheres to strict compliance requirements.

### SecureStore

The `@inception-health/cdk-secure-store` package offers a secure, scalable DynamoDB table construct. Features include encryption at rest, high availability, disaster recovery, and monitoring, making it an ideal solution for HIPAA-compliant data storage.

### Lambda

The `@inception-health/cdk-lambda` package simplifies AWS Lambda management by providing enhanced constructs with features like advanced logging, monitoring, and dead letter queue (DLQ) support.

## Getting started

To start using this repository, run the following command:

```bash
npm install @inception-health/cdk-secure-store @inception-health/cdk-lambda @inception-health/cdk-secure-bucket
```

If you use `yarn`, you can also run the command:

```bash
yarn add @inception-health/cdk-secure-store @inception-health/cdk-lambda @inception-health/cdk-secure-bucket
```

If you use `pnpm`, you can also run the command:

```bash
pnpm install @inception-health/cdk-secure-store @inception-health/cdk-lambda @inception-health/cdk-secure-bucket
```

## What is CDK

CDK is AWS Cloud Development Kit. It has been developed by AWS to enabled a better developer experience on top of their cloud platform. Before CDK, you have only a few options such as Terraform, or AWS Cloud Formation (CF). And if you did work at any large scale project with any of these options, you certainly came across the difficulties managing infrastructure as YAML files.

In that sense, AWS CDK is a framework that wraps CF and more importantly exposes the AWS Infrastructure as Code that you can write using any of your favorite programming language. And that is a marvelous idea. By making infrastructure _as code_, you can leverage all the power (to a certain extent) that a programming language has to offer such as linting, testing (unit testing, integration testing), autocompletion, Object-Oriented Programming (OOP) patterns such as inheritance, abstraction, etc, integration with your favorite IDE such as VSCode, and closing the gap between coding your infrastructure and your business logic.

> The idea of closing the gap between coding your infrastructure and your business logic is a discussion of its own right. It can be actually a curse; and a reckless amalgamation of both can come at our demise.


## Tools and Structure

This repository leverages modern tools and best practices to deliver a seamless developer experience:

- [TypeScript](https://www.typescriptlang.org/) for the programming language.
- [AWS CDK](https://aws.amazon.com/cdk/) for the infrastructure as Code constructs.
- [pnpm](https://pnpm.js.org/) for the package management system.
- [turborepo](https://turborepo.org/) a high-performance build system for JavaScript and TypeScript codebases.
- [eslint](https://eslint.org/) for code quality and linting.
- [prettier](https://prettier.io/) for code formatting.
- [changeset](https://github.com/changesets/changesets) to manage versioning and changelogs with a focus on monorepos.
- [jest](https://jestjs.io/) a delightful JavaScript Testing Framework with a focus on simplicity.

## Contributing

We welcome contributions! If you’d like to contribute, please follow our [CONTRIBUTING.md](CODE_OF_CONDUCT.md) guidelines for details on setting up your development environment, submitting pull requests, and our code of conduct.

## License

This repository is open-source and available under the [MIT License](LICENSE.md). See the LICENSE file for more details.

## Questions or Feedback?

If you have questions, feedback, or ideas to improve this library, feel free to open an issue.

Happy coding with Inception Health CDK Constructs! 🚀
