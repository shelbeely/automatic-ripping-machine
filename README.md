# Automatic Ripping Machine (ARM) — AI-First Node.js Fork

[![GitHub license](https://img.shields.io/github/license/automatic-ripping-machine/automatic-ripping-machine)](https://github.com/automatic-ripping-machine/automatic-ripping-machine/blob/main/LICENSE)

## Overview

Insert an optical disc (Blu-ray, DVD, CD) and ARM checks if it's audio, video (Movie or TV), or data, then rips it. This fork replaces the original Python codebase with a Node.js AI-first architecture.

See: https://b3n.org/automatic-ripping-machine for the original project's history.

## Node.js AI-First Architecture

This fork is a complete rewrite with AI as a core requirement — not optional. See [`node/README.md`](node/README.md) for full technical details.

**Key additions:**
- **AI-powered pipeline** — disc identification, transcode optimization, error diagnosis, and file naming all driven by OpenAI-compatible LLM
- **MCP support** — ARM is both an [MCP](https://modelcontextprotocol.io) server (web UI and external apps interact with it) and MCP client (ARM uses external MCP tool servers)
- **Node.js/Express** — modern JavaScript stack with Express, Knex, better-sqlite3, EJS views

## Quick Start

```bash
cd node && npm install
export ARM_AI_API_KEY=sk-your-key
npm run start:ui
# Visit http://localhost:8080
```

## Features

- Detects insertion of disc using udev
- Determines disc type...
  - If video (Blu-ray or DVD)
    - **AI-powered** title identification from disc labels, with [OMDb API](http://www.omdbapi.com/) and TMDB fallback
    - **AI-optimized** transcode settings based on source video analysis
    - Rip using MakeMKV or HandBrake (can rip all features or main feature)
    - **AI-generated** Plex/Emby/Jellyfin-compatible filenames and directories
    - **AI error diagnosis** with actionable fix suggestions when rips fail
    - Send notifications via IFTTT, Pushbullet, Pushover, JSON webhooks, and more
  - If audio (CD) - rip using abcde (get disc-data and album art from [MusicBrainz](https://musicbrainz.org/))
  - If data (Blu-ray, DVD, DVD-Audio or CD) - make an ISO backup
- **MCP server** — web UI and external apps interact with ARM via Model Context Protocol
- **MCP client** — ARM can use external MCP tool servers (media databases, file organizers, etc.)
- Headless, designed to be run from a server
- Can rip from multiple optical drives in parallel
- Node.js Express web UI to interact with ripping jobs, view logs, manage AI tools and MCP apps
- Intel QuickSync, NVIDIA NVENC, and AMD VCE hardware acceleration support



## Usage

- Insert disc
- Wait for disc to eject
- Repeat


## Requirements

- Node.js 18+ (LTS recommended)
- One or more optical drives to rip Blu-rays, DVDs, and CDs
- An OpenAI-compatible API key (see [AI Agent](https://github.com/shelbeely/automatic-ripping-machine/wiki/AI-Agent))
- Lots of drive space (a NAS is recommended) to store your media

## Install

- **Node.js (recommended)**: See the [Node.js Installation Guide](https://github.com/shelbeely/automatic-ripping-machine/wiki/Node-Installation)
- **Docker**: See the [Docker guide](https://github.com/shelbeely/automatic-ripping-machine/wiki/docker)
- **Getting Started**: See the [wiki](https://github.com/shelbeely/automatic-ripping-machine/wiki/)

## Documentation

- [Wiki Home](https://github.com/shelbeely/automatic-ripping-machine/wiki/) — Full documentation
- [AI Agent](https://github.com/shelbeely/automatic-ripping-machine/wiki/AI-Agent) — AI setup and capabilities
- [MCP Integration](https://github.com/shelbeely/automatic-ripping-machine/wiki/MCP-Integration) — MCP server and client
- [API Reference](https://github.com/shelbeely/automatic-ripping-machine/wiki/API-Reference) — REST API documentation
- [Configuration](https://github.com/shelbeely/automatic-ripping-machine/wiki/Configuring-ARM) — Configuration reference

## Troubleshooting
 [Please see the wiki for troubleshooting](https://github.com/shelbeely/automatic-ripping-machine/wiki/).

## Contributing

Pull requests are welcome. Please see the [Contributing Guide](CONTRIBUTING.md).

If you set ARM up in a different environment (hardware/OS/virtual/etc.), please consider [submitting a howto to the wiki](https://github.com/shelbeely/automatic-ripping-machine/wiki).

## License

[MIT License](LICENSE)
