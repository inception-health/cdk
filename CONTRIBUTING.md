# Contributing to Inception Health CDK Constructs

Thank you for your interest in contributing to Inception Health CDK Constructs! Contributions are critical to the success of this open-source project, and we value your ideas, suggestions, and code. Whether you’re fixing bugs, improving documentation, or adding new features, we appreciate your help in making this project better.

To ensure a smooth collaboration process, please review the following guidelines before contributing.

## How Can You Contribute?

Here are some ways you can contribute to this project:

  1. **Report Bugs**: Found a problem? Open a detailed issue with steps to reproduce.
  2. **Suggest Enhancements**: Propose new features or improvements via GitHub Issues.
  3. **Improve Documentation**: Help make the documentation clearer or more comprehensive.
  4. **Write Tests**: Add unit or integration tests to ensure the codebase remains robust.
  5. **Submit Code**: Fix bugs or implement new features.

## Getting Started

1. Fork the Repository

Start by forking the repository to your GitHub account.

2. Clone the Repository

Clone your fork to your local machine:

```bash
git clone https://github.com/your-username/CDK-Constructs.git
```

3. Set Up Your Environment

Install the dependencies using pnpm:

```bash
pnpm install
```

Ensure you have the following installed on your machine:
	•	Node.js (LTS version recommended)
	•	pnpm
	•	TypeScript

4. Create a Feature Branch

Create a new branch for your work:

```bash
git checkout -b feature/your-feature-name
```

## Contribution Workflow

1. **Write Your Code**: Make your changes or additions in the relevant package directory.
2. **Follow Code Standards**: Run pnpm lint and pnpm format to ensure code consistency.
3. **Write Tests**: Add or update tests using Jest. Run the test suite with pnpm test to confirm everything works as expected.
4. **Commit Changes**: Commit your work with clear and descriptive messages:

```bash
git commit -m "feat(SecureBucket): Add encryption configuration"
```

5. **Push Your Changes**: Push your branch to your fork:

```bash
git push origin feature/your-feature-name
```

6. **Open a Pull Request**: Go to the original repository and open a pull request. Provide a clear description of your changes and the problem you’re solving.

## Development Standards

### Code Style

This project follows strict coding standards enforced by:
- **ESLint**: Run `pnpm lint` to check for linting issues.

### Commit Messages

We use the Conventional Commits specification for commit messages. Follow this format:

```
<type>(scope): <description>

[optional body]

[optional footer]
```

**Types**:
- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation changes
- **style**: Code style changes (e.g., formatting, missing semicolons)
- **test**: Adding or modifying tests
- **chore**: Maintenance or minor changes (e.g., updating dependencies)

**Testing**

All new features and bug fixes must include relevant tests. Use Jest for unit and integration testing:
- Run all tests: `pnpm test`
- Run tests in watch mode: `pnpm test --watch`

### Guidelines for Pull Requests

- Keep pull requests focused and small.
- Reference the issue number (if applicable) in your pull request description.
- Ensure all tests pass before submitting your pull request.
- Review comments and address requested changes promptly.

### Community Guidelines

By contributing to this repository, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please treat everyone in the community with respect and professionalism.

## Questions or Need Help?

If you encounter any issues or need help with your contribution, feel free to:
- Open an issue on GitHub.
- Join the discussion in our GitHub Discussions.

We’re excited to have you contribute and help make Inception Health CDK Constructs even better! 🚀