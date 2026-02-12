# Copilot Instructions for Automatic Ripping Machine (ARM)

## Project Overview

ARM is an AI-first Node.js application for automatic optical disc ripping.
The primary codebase is in the `node/` directory. The original Python code
in `arm/` is legacy and should not be modified.

## Architecture

- **Runtime**: Node.js (CommonJS modules via `require()`)
- **Web framework**: Express 5 with EJS templates
- **UI framework**: Material Web (@material/web v2.4.0) via CDN import maps + custom MD3 CSS
- **Icons**: Material Icons Outlined via Google Fonts CDN
- **Database**: SQLite via Knex query builder + better-sqlite3
- **Testing**: Jest with `--forceExit` flag (205 tests, 13 suites)
- **AI**: OpenAI-compatible chat completions API (required, not optional)
- **MCP**: Model Context Protocol — ARM is both an MCP server and client
- **Metadata**: MKV tagging via mkvpropedit, OMDB via MCP client

### Material Web UI

ARM uses Google's Material Web (@material/web v2.4.0) via CDN import maps, plus custom
CSS classes for components Material Web doesn't provide (tables, cards, navigation, alerts).

All views follow this pattern:
```html
<!-- Head: Roboto font + Material Icons + custom theme + import map -->
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined" rel="stylesheet">
<link rel="stylesheet" href="/static/css/style.css">
<script type="importmap">
{
  "imports": {
    "@material/web/": "https://esm.run/@material/web@2.4.0/"
  }
}
</script>
<script type="module">
  import '@material/web/all.js';
  import {styles as typescaleStyles} from '@material/web/typography/md-typescale-styles.js';
  document.adoptedStyleSheets.push(typescaleStyles.styleSheet);
</script>

<!-- Body: dark mode, nav include, page wrapper -->
<body class="dark">
  <%- include('nav') %>
  <div class="page">
    <!-- Content here -->
  </div>
</body>
```

Material Web components used:
- Buttons: `<md-filled-button>`, `<md-outlined-button>`, `<md-filled-tonal-button>`
- Text fields: `<md-outlined-text-field label="Name" id="x" name="x">`
- Selects: `<md-outlined-select>` with `<md-select-option value="x"><div slot="headline">X</div></md-select-option>`
- Switches: `<md-switch id="x" name="x" selected>` (uses `selected` not `checked`)
- Dividers: `<md-divider>`
- Icon buttons: `<md-icon-button>`

Custom CSS classes (components Material Web doesn't provide):
- Cards: `<div class="md3-card">`
- Tables: `<table class="md3-table">`
- Alerts: `<div class="md3-alert info|error|success">`
- Status chips: `<span class="status-chip primary|error|success|warning">`
- Nav drawer: `<nav class="md3-nav-drawer">`
- App bar: `<header class="md3-app-bar">`
- Grid: `<div class="grid"><div class="s12 m6">...</div></div>`
- Icons: `<i class="material-icons-outlined">icon_name</i>`

Do NOT use Bootstrap classes. Material Web + custom MD3 CSS is the only UI framework.

Reference: https://material-web.dev/

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
    views/      — 18 EJS templates (Material Web + custom MD3 CSS)
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
- UI framework: Material Web (@material/web v2.4.0) via CDN import maps
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
1. Create EJS template in `node/src/ui/views/` following Material Web conventions above
2. Add route handler in `node/src/ui/server.js` or a sub-router module
3. Add navigation link in `node/src/ui/views/nav.ejs`
4. Add route test in `node/test/server_routes.test.js`

### Modifying the UI theme
1. Edit `node/src/ui/public/css/style.css` — uses CSS custom properties for MD3 tokens
2. Key variables: `--md-sys-color-primary`, `--md-sys-color-surface`, etc.
3. Reference: https://m3.material.io/styles/color/system/overview
