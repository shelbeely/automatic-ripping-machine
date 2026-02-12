## Overview

**Automatic Ripping Machine (ARM)** is an AI-first Node.js application that automatically detects and rips optical discs (Blu-ray, DVD, CD). AI is a core component — not optional — powering intelligent disc identification, transcode optimization, error diagnosis, and media file organization.

ARM also supports the [Model Context Protocol (MCP)](https://modelcontextprotocol.io), acting as both an MCP server (so external apps and UIs can interact with it) and an MCP client (so ARM can use external MCP tool servers for media databases, file organizers, and more).

See: https://b3n.org/automatic-ripping-machine for the original project's history.

> **Note:** This is the Node.js AI-first fork. The legacy Python version is preserved in the `arm/` directory but is no longer actively developed.

## Get Started

[Getting Started](Getting-Started) on your journey with ARM.

## Architecture

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js (CommonJS) |
| Web framework | Express 5 + EJS templates |
| Database | SQLite via Knex + better-sqlite3 |
| AI | OpenAI-compatible chat completions API (**required**) |
| MCP | Model Context Protocol — ARM is both server and client |
| Testing | Jest with `--forceExit` |

## Current Features

- Detects insertion of disc using udev
- Determines disc type...
  - If video (Blu-ray or DVD)
    - **AI-powered** title identification from disc labels, with OMDb/TMDB API fallback
    - **AI-optimized** transcode settings based on source video analysis (resolution, codec, bitrate)
    - Rip using MakeMKV or HandBrake (can rip all features or main feature)
    - **AI-generated** Plex/Emby/Jellyfin-compatible filenames and directory structures
    - **AI error diagnosis** with actionable fix suggestions when rips fail
    - Eject disc and queue up HandBrake transcoding when done
    - Send notifications via IFTTT, Pushbullet, Pushover, JSON webhooks, and more
  - If audio (CD) - rip using abcde (get disc-data and album art from [MusicBrainz](https://musicbrainz.org/))
  - If data (Blu-ray, DVD, or CD) - make an ISO backup
- **MCP server** — Web UI and external apps interact with ARM via Model Context Protocol
- **MCP client** — ARM can use external MCP tool servers (media databases, file organizers, etc.)
- Headless, designed to be run from a server
- Ripping from multiple optical drives in parallel
- Node.js Express web UI to interact with ripping jobs, view logs, manage AI tools and MCP apps
- Intel QuickSync, NVIDIA NVENC, and AMD VCE hardware acceleration support

## AI Capabilities

ARM includes four AI agent capabilities, all powered by an OpenAI-compatible LLM:

| Capability | Description |
|-----------|-------------|
| **Disc Identification** | Parses cryptic disc labels (e.g., `STAR_WARS_EP_IV`) into clean titles, years, and types |
| **Transcode Optimization** | Analyzes video metadata and recommends optimal HandBrake/FFmpeg settings |
| **Error Diagnosis** | Analyzes rip/transcode error logs and provides human-readable diagnosis with fix suggestions |
| **File Naming** | Generates Plex/Emby/Jellyfin-compatible filenames and directory structures |

See [AI Agent](AI-Agent) for setup and configuration details.

## MCP Integration

ARM supports the [Model Context Protocol](https://modelcontextprotocol.io) in two ways:

- **As an MCP Server**: ARM exposes 7 tools and 3 resources via `/mcp/message` endpoint, allowing the web UI and external MCP-compatible apps to interact with ARM.
- **As an MCP Client**: ARM can connect to external MCP tool servers (configured in `MCP_APPS`) for additional capabilities like media database lookups or file organization.

See [MCP Integration](MCP-Integration) for full details.