# Inception Health CDK Constructs

## Getting started

To start using this repository, run the following command:

```bash
npm install @inception-health/cdk
```

If you use `yarn`, you can also run the command:

```bash
yarn add @inception-health/cdk
```

If you use `pnpm`, you can also run the command:

```bash
pnpm install @inception-health/cdk
```

## What is CDK

CDK is AWS Cloud Development Kit. It has been developed by AWS to enabled a better developer experience on top of their cloud platform. Before CDK, you have only a few options such as Terraform, or AWS Cloud Formation (CF). And if you did work at any large scale project with any of these options, you certainly came across the difficulties managing infrastructure as YAML files.

In that sense, AWS CDK is a framework that wraps CF and more importantly exposes the AWS Infrastructure as Code that you can write using any of your favorite programming language. And that is a marvelous idea. By making infrastructure _as code_, you can leverage all the power (to a certain extent) that a programming language has to offer such as linting, testing (unit testing, integration testing), autocompletion, Object-Oriented Programming (OOP) patterns such as inheritance, abstraction, etc, integration with your favorite IDE such as VSCode, and closing the gap between coding your infrastructure and your business logic.

> The idea of closing the gap between coding your infrastructure and your business logic is a discussion of its own right. It can be actually a curse; and a reckless amalgamation of both can come at our demise.

## Vision

Inception Health has identified CDK as a way to distribute our opinionated mechanisms for leveraging aws resources in the "right" ways.

## Key Features

* Tied deeply into AWS using native tools.
* Built with HIPAA Compliance and Security in mind.
* Typescript infrastructure as code.
* Opinionated constructs allow teams to focus on their product and not AWS APIs.

## Tools and Structure

This monorepo is based on the following tools and technologies:

- [TypeScript](https://www.typescriptlang.org/) for the programming language.
- [AWS CDK](https://aws.amazon.com/cdk/) for the infrastructure as Code constructs.
- [pnpm](https://pnpm.js.org/) for the package management system.
- [turborepo](https://turborepo.org/) a high-performance build system for JavaScript and TypeScript codebases.
- [codecov](https://codecov.io/) for code coverage reporting.
- [eslint](https://eslint.org/) for code quality and linting.
- [prettier](https://prettier.io/) for code formatting.
- [changeset](https://github.com/changesets/changesets) to manage versioning and changelogs with a focus on monorepos.
- [jest](https://jestjs.io/) a delightful JavaScript Testing Framework with a focus on simplicity.
