# Contributing Guide
## Introduction
Thank you for contributing to the Automatic Ripping Machine.

## Overview

ARM is an AI-first Node.js application. The primary codebase is in the `node/` directory. The original Python code in `arm/` is legacy and should not be modified.

## Issues, Bugs, and Feature Requests
If you find a bug, please include:
- Your Node.js version (`node --version`)
- The relevant log output (set log level to DEBUG in `arm.yaml` for detailed logs)
- Steps to reproduce the issue

Since ARM relies on software such as HandBrake and MakeMKV, try running those programs manually to see if it's an issue there. If you run ARM in DEBUG mode you should be able to see the exact call-out to each program.

When submitting a bug, enhancement, or feature request please indicate if you are able/willing to make the changes yourself in a pull request.

## Pull Requests
Please submit pull requests against the `main` branch.

To make a pull request, fork this project into your own GitHub repository and after making changes create a PR. Read https://help.github.com/articles/creating-a-pull-request/

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

### Testing

- Run tests: `cd node && npx jest --forceExit`
- Mock `axios` for AI/HTTP tests: `jest.mock('axios')`
- Use file-based SQLite for database tests
- Test file naming: `test/<module_name>.test.js`

Test your changes locally before submitting. All existing tests must pass.

If you are making multiple changes, please create separate pull requests so they can be evaluated individually (if changes are trivial or dependent on each other, one PR is fine).

Update documentation if your changes require it.

## Hardware/OS Documentation
If you have successfully set ARM up in a different environment and would like to assist others, please submit a howto to the [wiki](https://github.com/shelbeely/automatic-ripping-machine/wiki).

## Testing, Quality, etc.
If you are interested in helping out with testing, quality, etc. please let us know.

