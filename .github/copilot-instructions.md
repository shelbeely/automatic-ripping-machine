# Copilot Instructions for Automatic Ripping Machine (ARM)

## Project Overview

ARM is an AI-first Node.js application for automatic optical disc ripping.
The primary codebase is in the `node/` directory. The original Python code
in `arm/` is legacy and should not be modified.

## Architecture

- **Runtime**: Node.js (CommonJS modules via `require()`)
- **Web framework**: Express 5 with EJS templates
- **UI framework**: Beer CSS 3.7.14 (Material Design 3 Expressive) via CDN
- **Icons**: Material Icons Outlined via Google Fonts CDN
- **Database**: SQLite via Knex query builder + better-sqlite3
- **Testing**: Jest with `--forceExit` flag (205 tests, 13 suites)
- **AI**: OpenAI-compatible chat completions API (required, not optional)
- **MCP**: Model Context Protocol — ARM is both an MCP server and client
- **Metadata**: MKV tagging via mkvpropedit, OMDB via MCP client

### Why Beer CSS?

ARM uses Beer CSS (https://www.beercss.com/) for the UI framework because:
- ARM renders server-side EJS templates — not React, Angular, or Vue
- Beer CSS is a pure CSS + minimal JS framework that works with any HTML
- It implements Material Design 3 Expressive with complete component coverage
- Available via CDN with no build step required
- Includes tables, navigation drawer, app bar, chips, dialogs, forms — all components ARM needs
- Alternative `@material/web` is in maintenance mode and lacks tables, top app bar, and navigation rail
- MUI requires React; Angular Material requires Angular — both incompatible with EJS

### Beer CSS Conventions

All views follow this pattern:
```html
<!-- Head: Beer CSS + Material Icons + custom theme -->
<link href="https://cdn.jsdelivr.net/npm/beercss@3.7.14/dist/cdn/beer.min.css" rel="stylesheet">
<link href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined" rel="stylesheet">
<link rel="stylesheet" href="/static/css/style.css">

<!-- Body: dark mode, nav include, page wrapper -->
<body class="dark">
  <%- include('nav') %>
  <div class="page">
    <!-- Content here -->
  </div>

  <!-- Bottom: Beer CSS JS -->
  <script type="module" src="https://cdn.jsdelivr.net/npm/beercss@3.7.14/dist/cdn/beer.min.js"></script>
  <script type="module" src="https://cdn.jsdelivr.net/npm/material-dynamic-colors@1.1.4/dist/cdn/material-dynamic-colors.min.js"></script>
</body>
```

Key Beer CSS patterns used in ARM views:
- Cards: `<article class="surface-container round">`
- Tables: `<table class="stripes">`
- Buttons: `<button class="primary small">`, `<a class="button small border">`
- Chips/Badges: `<span class="chip small primary">`, `<span class="chip small error">`
- Form fields: `<div class="field border round"><input><label></label></div>`
- Switches: `<label class="switch"><input type="checkbox"><span></span></label>`
- Alerts: `<div class="primary-container round padding">`, `error-container`, `tertiary-container`
- Grid: `<div class="grid"><div class="s12 m6 l4">...</div></div>`
- Icons: `<i>icon_name</i>` (Material Icons Outlined font)
- Nav drawer: `<nav id="nav-drawer" class="left drawer">`
- Top app bar: `<header class="fixed"><nav>...</nav></header>`

Do NOT use Bootstrap classes. Beer CSS is the only CSS framework.

Reference: https://www.beercss.com/

## Key Conventions

### AI is Core
- AI is **required**, not optional. The `AI_API_KEY` must be configured.
- Use `requireAgent(config)` at pipeline entry points to fail fast.
- Use `createAgent(config)` in contexts where graceful degradation is acceptable (e.g., within an already-running job).
- Never silently skip AI features — at minimum log a warning.
- 5 AI capabilities: parseDiscLabel, recommendTranscodeSettings, diagnoseError, generateMediaFilename, fetchMediaCredits

### MCP Integration
- ARM acts as an **MCP server** (web UI and external apps call ARM's tools via `/mcp/message`).
- ARM acts as an **MCP client** (connects to external MCP tool servers configured in `MCP_APPS`).
- MCP server code: `node/src/mcp/mcp_server.js` — 8 tools + 3 resources
- MCP client code: `node/src/mcp/mcp_client.js` — stdio transport, env field support, resource discovery
- OMDB MCP server (`shelbeely/omdb-mcp-server`) is the recommended first MCP app for metadata lookup

### MKV Metadata Tagging
- `generateMkvTagsXml()` and `writeMkvTags()` in `node/src/ripper/utils.js`
- Uses `mkvpropedit` CLI to apply Matroska XML tags
- Integrated as Phase 2.5 in `arm_ripper.js` pipeline between transcode and file move
- `fetchMediaCredits()` in `ai_agent.js` fetches structured credits for tagging

### Code Style
- Use `const` for requires and immutable bindings, `let` for mutable.
- Use async/await for all asynchronous operations.
- Use Winston logger: `const logger = createLogger('module-name')`.
- Wrap external calls (AI, MCP, HTTP) in try/catch with `logger.warn()`.
- All API endpoints return `{ success: boolean, ... }` JSON.

### File Organization
```
node/src/
  config/       — YAML config loading (arm.yaml, apprise.yaml, abcde.conf)
  models/       — Database models (Job, Track, Config, User, Notification, SystemInfo, SystemDrives)
  mcp/          — MCP server (8 tools) and client (stdio transport)
  ripper/       — Core ripping pipeline (identify → rip → transcode → tag → move)
    ai_agent.js — 5 AI capabilities
    identify.js — MCP-based OMDB lookup → direct OMDB API → TMDB fallback
    utils.js    — MKV tagging, file operations
  ui/
    views/      — 18 EJS templates (Beer CSS Material Design 3 Expressive)
    public/     — Static assets (css/style.css, js/app.js)
    api.js      — REST API endpoints (/api/*)
    server.js   — Express app factory, route registration
    auth/       — Login, logout, password update with bcrypt + rate limiting
    settings/   — Config editing, system info, drive management
    database/   — Database browser with table viewer
    sendmovies/ — Completed media file browser
```

### Testing
- Run tests: `cd node && npx jest --forceExit`
- 205 tests across 13 test suites
- Mock `axios` for AI/HTTP tests: `jest.mock('axios')`
- Use `os.tmpdir()` for test database files
- Test file naming: `test/<module_name>.test.js`
- Server route integration tests: `test/server_routes.test.js`

### Dependencies
- Check `node/package.json` for current dependencies before adding new ones.
- Use `@modelcontextprotocol/sdk` for MCP client functionality.
- Import MCP SDK client: `require('@modelcontextprotocol/sdk/client')`
- Import MCP SDK stdio: `require('@modelcontextprotocol/sdk/client/stdio.js')`
- UI framework: Beer CSS 3.7.14 via CDN (https://www.beercss.com/)
- Icons: Material Icons Outlined via Google Fonts CDN

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

### Adding a new web UI page
1. Create EJS template in `node/src/ui/views/` following Beer CSS conventions above
2. Add route handler in `node/src/ui/server.js` or a sub-router module
3. Add navigation link in `node/src/ui/views/nav.ejs`
4. Add route test in `node/test/server_routes.test.js`

### Modifying the UI theme
1. Edit `node/src/ui/public/css/style.css` — uses CSS custom properties for MD3 tokens
2. Key variables: `--md-sys-color-primary`, `--md-sys-color-surface`, etc.
3. Reference: https://m3.material.io/styles/color/system/overview
