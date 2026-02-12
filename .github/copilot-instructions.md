# Copilot Instructions for Automatic Ripping Machine (ARM)

## Project Overview

ARM is an AI-first Node.js application for automatic optical disc ripping.
The primary codebase is in the `node/` directory. The original Python code
in `arm/` is legacy and should not be modified.

## Architecture

- **Runtime**: Node.js (CommonJS modules via `require()`)
- **Web framework**: Express 5 with EJS templates
- **Database**: SQLite via Knex query builder + better-sqlite3
- **Testing**: Jest with `--forceExit` flag
- **AI**: OpenAI-compatible chat completions API (required, not optional)
- **MCP**: Model Context Protocol — ARM is both an MCP server and client

## Key Conventions

### AI is Core
- AI is **required**, not optional. The `AI_API_KEY` must be configured.
- Use `requireAgent(config)` at pipeline entry points to fail fast.
- Use `createAgent(config)` in contexts where graceful degradation is acceptable (e.g., within an already-running job).
- Never silently skip AI features — at minimum log a warning.

### MCP Integration
- ARM acts as an **MCP server** (web UI and external apps call ARM's tools via `/mcp/message`).
- ARM acts as an **MCP client** (connects to external MCP tool servers configured in `MCP_APPS`).
- MCP server code: `node/src/mcp/mcp_server.js`
- MCP client code: `node/src/mcp/mcp_client.js`

### Code Style
- Use `const` for requires and immutable bindings, `let` for mutable.
- Use async/await for all asynchronous operations.
- Use Winston logger: `const logger = createLogger('module-name')`.
- Wrap external calls (AI, MCP, HTTP) in try/catch with `logger.warn()`.
- All API endpoints return `{ success: boolean, ... }` JSON.

### File Organization
```
node/src/
  config/     — YAML config loading
  models/     — Database models (Job, Track, Config, User, etc.)
  mcp/        — MCP server and client
  ripper/     — Core ripping pipeline (identify, rip, transcode, move)
  ui/         — Express web UI (routes, views, API, static assets)
```

### Testing
- Run tests: `cd node && npx jest --forceExit`
- Mock `axios` for AI/HTTP tests: `jest.mock('axios')`
- Use file-based SQLite for database tests
- Test file naming: `test/<module_name>.test.js`

### Dependencies
- Check `node/package.json` for current dependencies before adding new ones.
- Use `@modelcontextprotocol/sdk` for MCP client functionality.
- Import MCP SDK client: `require('@modelcontextprotocol/sdk/client')`
- Import MCP SDK stdio: `require('@modelcontextprotocol/sdk/client/stdio.js')`

## Common Tasks

### Adding a new AI capability
1. Add the function to `node/src/ripper/ai_agent.js`
2. Integrate it into the relevant pipeline module
3. Add an API endpoint in `node/src/ui/api.js`
4. Add an MCP tool definition in `node/src/mcp/mcp_server.js`
5. Write tests in `node/test/ai_agent.test.js`

### Adding a new MCP tool
1. Add tool definition to `TOOLS` array in `node/src/mcp/mcp_server.js`
2. Add handler in `handleToolCall()` switch statement
3. Add tests in `node/test/mcp_server.test.js`

### Adding a new API endpoint
1. Add route in `node/src/ui/api.js`
2. Use `requireAgent()` for AI-dependent endpoints
3. Return `{ success: true, ... }` or `{ success: false, error: '...' }`
