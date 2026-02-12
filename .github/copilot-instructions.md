# Copilot Instructions for Automatic Ripping Machine (ARM)

## Project Overview

ARM is an AI-first Node.js application for automatic optical disc ripping.
The primary codebase is in the `node/` directory. The original Python code
in `arm/` is legacy and should not be modified.

## Architecture

- **Runtime**: Node.js (CommonJS modules via `require()`)
- **Web framework**: Express 5 with EJS templates
- **UI framework**: Hybrid MDC-Web v14.0.0 (MD2) + Material Web v2.4.0 (MD3) via CDN
- **Icons**: Material Icons Outlined via Google Fonts CDN
- **Database**: SQLite via Knex query builder + better-sqlite3
- **Testing**: Jest with `--forceExit` flag (205 tests, 13 suites)
- **AI**: OpenAI-compatible chat completions API (required, not optional)
- **MCP**: Model Context Protocol — ARM is both an MCP server and client
- **Metadata**: MKV tagging via mkvpropedit, OMDB via MCP client

### Hybrid MDC-Web + Material Web UI

ARM uses a hybrid approach combining two official Google Material libraries:

1. **MDC-Web v14.0.0 (Material Design 2)** — for components Material Web doesn't provide:
   - Data tables (`mdc-data-table`)
   - Navigation drawer (`mdc-drawer--dismissible`)
   - Top app bar (`mdc-top-app-bar--fixed`)
   - List items (`mdc-list`, `mdc-list-item`)
   - Reference: https://github.com/material-components/material-components-web

2. **Material Web v2.4.0 (@material/web, Material Design 3)** — for interactive form components:
   - Buttons: `<md-filled-button>`, `<md-outlined-button>`, `<md-filled-tonal-button>`
   - Text fields: `<md-outlined-text-field label="Name" id="x" name="x">`
   - Selects: `<md-outlined-select>` with `<md-select-option value="x"><div slot="headline">X</div></md-select-option>`
   - Switches: `<md-switch id="x" name="x" selected>` (uses `selected` not `checked`)
   - Dividers: `<md-divider>`
   - Reference: https://material-web.dev/

3. **Custom CSS classes** — for components neither library provides:
   - Cards: `<div class="md3-card">`
   - Alerts: `<div class="md3-alert info|error|success">`
   - Status chips: `<span class="status-chip primary|error|success|warning">`
   - Grid: `<div class="grid"><div class="s12 m6">...</div></div>`

**Why hybrid?** Material Web (@material/web) is in maintenance mode and missing critical
components (data tables, navigation drawer, top app bar — all listed as "Future" on their
roadmap but never built). MDC-Web v14.0.0 provides these. MUI requires React (incompatible
with EJS server-rendering). Angular Material requires Angular.

All views use a shared `head.ejs` partial and follow this pattern:
```html
<head>
  <title>Page Title</title>
  <%- include('head') %>  <!-- loads MDC-Web CSS/JS, Material Web import map, theme CSS -->
</head>
<body class="dark">
  <%- include('nav') %>   <!-- MDC drawer + top app bar, opens mdc-drawer-app-content div -->
  <div class="page">
    <!-- Page content here -->
  </div>
  </div> <!-- closes mdc-drawer-app-content from nav.ejs -->
  <script>
    // MDC drawer + top app bar initialization (required in every view)
    var drawer = mdc.drawer.MDCDrawer.attachTo(document.querySelector('.mdc-drawer'));
    var topAppBar = mdc.topAppBar.MDCTopAppBar.attachTo(document.querySelector('.mdc-top-app-bar'));
    topAppBar.setScrollTarget(document.querySelector('.page'));
    topAppBar.listen('MDCTopAppBar:nav', function() {
      drawer.open = !drawer.open;
    });
    if (window.innerWidth >= 993) drawer.open = true;
  </script>
</body>
```

MDC Data Table pattern (replaces all `<table>` elements):
```html
<div class="mdc-data-table">
  <div class="mdc-data-table__table-container">
    <table class="mdc-data-table__table" aria-label="Description">
      <thead>
        <tr class="mdc-data-table__header-row">
          <th class="mdc-data-table__header-cell" role="columnheader" scope="col">Column</th>
        </tr>
      </thead>
      <tbody class="mdc-data-table__content">
        <tr class="mdc-data-table__row">
          <td class="mdc-data-table__cell">Data</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

Do NOT use Bootstrap or Beer CSS. The hybrid MDC-Web + Material Web stack is the only UI framework.

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
    views/      — 19 EJS templates (head.ejs shared partial + 16 pages + nav.ejs + layout.ejs)
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
- UI framework: Hybrid MDC-Web v14.0.0 (MD2) + Material Web v2.4.0 (MD3) via CDN
- MDC-Web: data tables, navigation drawer, top app bar (via unpkg CDN)
- Material Web: buttons, text fields, switches, selects (via esm.run CDN import maps)
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
1. Create EJS template in `node/src/ui/views/` using `<%- include('head') %>` and `<%- include('nav') %>`
2. Use MDC data tables for tabular data, Material Web for form components, custom CSS for cards/alerts
3. Include MDC drawer/top-app-bar init script at bottom of every view
4. Add route handler in `node/src/ui/server.js` or a sub-router module
5. Add navigation link in `node/src/ui/views/nav.ejs`
6. Add route test in `node/test/server_routes.test.js`

### Modifying the UI theme
1. Edit `node/src/ui/public/css/style.css` — uses CSS custom properties for both MD3 tokens and MDC theming
2. MD3 key variables: `--md-sys-color-primary`, `--md-sys-color-surface`, etc.
3. MDC key variables: `--mdc-theme-primary`, `--mdc-theme-surface`, etc.
4. Reference: https://m3.material.io/styles/color/system/overview
5. Reference: https://github.com/material-components/material-components-web/blob/master/docs/theming.md
