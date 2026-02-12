# Automatic Ripping Machine (ARM) — Node.js AI-First Fork

An AI-powered, Node.js-based automatic disc ripping machine. Insert a disc
(Blu-ray, DVD, CD) and ARM identifies it, rips it, transcodes it, and
organizes the output into your media library — all driven by AI agents.

## What's Different in This Fork

- **Node.js** — Complete rewrite from Python/Flask to Node.js/Express
- **AI-First** — AI is core, not optional. Every disc identification,
  transcode optimization, error diagnosis, and file naming decision is
  powered by an OpenAI-compatible LLM
- **MCP Support** — Full [Model Context Protocol](https://modelcontextprotocol.io)
  integration: ARM is both an MCP server (the web UI and external apps
  interact with it via MCP) and an MCP client (ARM can use external MCP
  tool servers for media databases, file organization, etc.)

## Quick Start

```bash
cd node
npm install

# Required: set your AI API key
export ARM_AI_API_KEY=sk-your-openai-key-here

# Start the web UI
npm run start:ui

# Or start a rip directly
node src/ripper/main.js /dev/sr0
```

## Configuration

### Required

| Variable | Config Key | Description |
|----------|-----------|-------------|
| `ARM_AI_API_KEY` | `AI_API_KEY` | OpenAI-compatible API key (**required**) |

### Optional AI Settings

| Variable | Config Key | Default | Description |
|----------|-----------|---------|-------------|
| `ARM_AI_API_URL` | `AI_API_URL` | `https://api.openai.com/v1/chat/completions` | API endpoint |
| `ARM_AI_MODEL` | `AI_MODEL` | `gpt-4o-mini` | Model to use |

### MCP Apps (Optional)

ARM can connect to external MCP tool servers. Add to `arm.yaml`:

```yaml
MCP_APPS:
  - name: media-db
    command: npx
    args: ["-y", "@some/mcp-media-server"]
  - name: file-organizer
    command: node
    args: ["path/to/server.js"]
```

Or set `ARM_MCP_APPS` environment variable as a JSON array.

### MCP Server

ARM exposes itself as an MCP server at `http://localhost:8080/mcp`.
The web UI interacts with ARM through this MCP interface, and external
MCP-compatible apps can connect to it as well.

**Available MCP Tools:**
- `identify_disc` — Parse disc labels into clean titles
- `get_jobs` / `get_job` — Query ripping job status
- `diagnose_error` — AI-powered error diagnosis
- `recommend_transcode` — AI transcode settings optimizer
- `generate_filename` — Plex/Emby/Jellyfin filename generator
- `get_system_info` — System hardware/software info

**Available MCP Resources:**
- `arm://jobs` — All ripping jobs
- `arm://config` — Configuration (secrets redacted)
- `arm://system` — System information

## AI Capabilities

### 1. Disc Identification
Parses cryptic disc labels (e.g., `STAR_WARS_EP_IV_DISC1`) into proper
titles, years, and types. Falls back to OMDB/TMDB for metadata enrichment.

### 2. Transcode Optimization
Probes source video metadata (resolution, codec, bitrate, audio/subtitle
tracks) and recommends optimal HandBrake/FFmpeg presets, quality settings,
and audio strategies.

### 3. Error Diagnosis
When ripping or transcoding fails, analyzes error logs and provides
human-readable diagnosis with severity, actionable suggestions, and
retry advice.

### 4. File Organization
Generates Plex/Emby/Jellyfin-compatible filenames and directory structures:
- Movies: `movies/Title (Year)/Title (Year).mkv`
- TV: `tv/Show Name/Season 01/Show Name - S01E03 - Episode Title.mkv`

## Web UI

The web UI is accessible at `http://localhost:8080` and provides:
- Active rips dashboard
- Job history and details
- AI tools dashboard
- MCP server info and connected MCP apps status
- Settings, logs, and notifications

## Testing

```bash
cd node
npm test
```

## Architecture

```
Disc Inserted
    ↓
main.js (entry — validates AI config, initializes MCP apps)
    ↓
identify.js (AI-powered disc identification + OMDB/TMDB)
    ↓
arm_ripper.js
    ├→ MakeMKV (decrypt & extract)
    ├→ AI: recommend transcode settings
    ├→ HandBrake/FFmpeg (transcode)
    ├→ AI: generate media-library filenames
    ├→ Move files to organized media library
    └→ On error: AI diagnosis with fix suggestions
    ↓
Web UI ←→ MCP Server ←→ External MCP Apps
```

## License

[MIT License](../LICENSE)
