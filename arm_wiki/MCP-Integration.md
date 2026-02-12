# MCP Integration

ARM supports the [Model Context Protocol (MCP)](https://modelcontextprotocol.io) in two complementary ways:

1. **ARM as an MCP Server** — The web UI and external MCP-compatible apps can call ARM's tools and read ARM's resources
2. **ARM as an MCP Client** — ARM connects to external MCP tool servers for additional capabilities

## ARM as an MCP Server

ARM exposes its capabilities as MCP tools and resources via an HTTP endpoint at `/mcp/message`. This uses the [JSON-RPC 2.0](https://www.jsonrpc.org/specification) protocol as defined by the MCP specification.

### Available Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `identify_disc` | AI-powered disc label identification | `label` (string), `discType` (string, optional) |
| `get_jobs` | List ripping jobs | `status` (string, optional: "active", "completed", "failed") |
| `get_job` | Get detailed job info | `id` (number, required) |
| `diagnose_error` | AI error diagnosis | `errorLog` (string), `context` (string, optional) |
| `recommend_transcode` | AI transcode optimization | `videoInfo` (object: resolution, codec, bitrate, etc.) |
| `generate_filename` | AI media filename generation | `title` (string), `year` (number), `type` (string) |
| `get_system_info` | System hardware/software info | (none) |

### Available Resources

| URI | Description |
|-----|-------------|
| `arm://jobs` | All ripping jobs with status |
| `arm://config` | ARM configuration (secrets redacted) |
| `arm://system` | System information |

### Usage

Send a JSON-RPC 2.0 request to `POST /mcp/message`:

**List available tools:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}
```

**Call a tool:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "identify_disc",
    "arguments": {
      "label": "STAR_WARS_EP_IV",
      "discType": "bluray"
    }
  }
}
```

**Read a resource:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "resources/read",
  "params": {
    "uri": "arm://jobs"
  }
}
```

### MCP Apps (ext-apps) Support

ARM's MCP server implements the [MCP ext-apps specification](https://modelcontextprotocol.github.io/ext-apps/api/), enabling MCP-compatible applications to discover and interact with ARM. The web UI itself interacts with ARM through the MCP server interface, making the web UI an MCP app.

## ARM as an MCP Client

ARM can connect to external MCP tool servers to extend its capabilities. For example, you could connect ARM to:

- A **media database** MCP server for enhanced metadata lookup
- A **file organization** MCP server for custom filing rules
- A **notification** MCP server for additional notification channels
- Any other MCP-compatible tool server

### Configuration

Configure MCP apps in `arm.yaml`:

```yaml
MCP_APPS:
  - name: "media-db"
    command: "npx"
    args: ["-y", "@some/mcp-media-server"]
  - name: "file-organizer"
    command: "node"
    args: ["/path/to/organizer-server.js"]
  - name: "custom-tool"
    command: "python"
    args: ["-m", "my_mcp_server"]
```

Or via environment variable (JSON):

```bash
export ARM_MCP_APPS='[{"name":"media-db","command":"npx","args":["-y","@some/mcp-media-server"]}]'
```

Each app entry supports:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display name for the app |
| `command` | string | Executable to launch the MCP server |
| `args` | string[] | Command line arguments |
| `env` | object | Environment variables to pass to the child process |

### OMDB MCP Server

ARM can connect to the [OMDB MCP Server](https://github.com/shelbeely/omdb-mcp-server) for enhanced movie/TV metadata lookup powered by the [Open Movie Database API](https://omdbapi.com/).

**Available tools from OMDB MCP Server:**

| Tool | Description |
|------|-------------|
| `search_movies` | Search for movies by title, with optional year and type filters |
| `get_movie_details` | Get detailed information about a movie by title |
| `get_movie_by_imdb_id` | Look up a movie by its IMDB ID |

**Setup:**

1. Get a free API key from [omdbapi.com](https://omdbapi.com/apikey.aspx)
2. Add to your `arm.yaml`:

```yaml
MCP_APPS:
  - name: omdb
    command: npx
    args: ["-y", "omdb-mcp-server"]
    env:
      OMDB_API_KEY: "your-omdb-api-key"
```

The OMDB MCP server will be automatically launched and connected when ARM starts. Its tools will be available in the MCP Apps page and through the API.

### How It Works

1. At startup, ARM connects to each configured MCP app via stdio transport
2. ARM discovers the tools each app provides
3. Tools from all connected apps are available through the web UI and API
4. ARM can call tools across connected apps as needed

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/mcp/tools` | List all tools from all connected MCP apps |
| POST | `/api/mcp/call` | Call a tool on a specific MCP app |

**List MCP tools:**
```
GET /api/mcp/tools
```

**Call an MCP tool:**
```json
POST /api/mcp/call
{
  "appName": "media-db",
  "toolName": "search_movie",
  "arguments": { "query": "Star Wars" }
}
```

### Web UI

The MCP Apps page (accessible from **AI Tools > MCP Apps** in the navigation) shows:

- Status of all configured MCP apps (connected/disconnected)
- Available tools from each connected app
- Ability to test tool calls from the browser

## Testing

```bash
cd node
npx jest test/mcp_server.test.js test/mcp_client.test.js --forceExit
```
