# Contributing Guide
## Introduction
Thank you for contributing to the Automatic Ripping Machine.

## Issues, Bugs, and Feature Requests
If you find a bug, please include:
- Your Node.js version (`node --version`)
- The relevant log output (set log level to DEBUG in `arm.yaml` for detailed logs)
- Steps to reproduce the issue

Since ARM relies on software such as HandBrake and MakeMKV,
try running those programs manually to see if it's an issue there.
If you run ARM in DEBUG mode you should
be able to see the exact call-out to each program.

When submitting a bug, enhancement, or feature request please indicate if you are able/willing to make the changes yourself in a pull request.

## Making Code Changes

To make changes to the code, fork this project into your own GitHub repository.
More information can be found in the [GitHub docs](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/fork-a-repo).

### Development Setup

```bash
cd node
npm install
npm test  # Run all tests — they should pass before you start
```

### Code Style

- Use `const` for requires and immutable bindings, `let` for mutable
- Use async/await for all asynchronous operations
- Use Winston logger: `const logger = createLogger('module-name')`
- Wrap external calls (AI, MCP, HTTP) in try/catch with `logger.warn()`
- All API endpoints return `{ success: boolean, ... }` JSON

### AI is Core

- AI is **required**, not optional. The `AI_API_KEY` must be configured.
- Use `requireAgent(config)` at pipeline entry points to fail fast
- Use `createAgent(config)` within running jobs for graceful degradation
- Never silently skip AI features — at minimum log a warning

Once the new feature or bugfix has been incorporated,
test your changes locally to ensure no new bugs have been introduced.

If significant changes have been made to ARM, ensure the following:
- Update the README file in your PR
- Update the ARM Wiki

## Raise a Pull Request

Once your code is ready, raise a new Pull Request (PR) within GitHub from your fork to the ARM main branch.
For additional information, see the [GitHub Docs](https://help.github.com/articles/creating-a-pull-request/)

To make it easier on the Developers reviewing any PR, avoid creating massive changes to the code base in one PR.
Where possible, try to reduce changes to a small feature or bug fix for easy review.

ARM versioning follows the [Semantic Versioning](https://semver.org/) standard.

## Hardware/OS Documentation
If you have successfully set ARM up in a different environment and would like to assist others, please submit a howto to the [wiki](https://github.com/shelbeely/automatic-ripping-machine/wiki).

## Testing

ARM uses [Jest](https://jestjs.io/) for testing. Run the test suite with:

```bash
cd node
npx jest --forceExit
```

- Mock `axios` for AI/HTTP tests: `jest.mock('axios')`
- Use file-based SQLite for database tests
- Test file naming: `test/<module_name>.test.js`

All 145+ tests must pass before submitting a PR.

If you are interested in helping out with testing, quality, etc. please let us know.
