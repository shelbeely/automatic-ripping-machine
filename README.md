# Automatic Ripping Machine (ARM)
[![CI](https://github.com/automatic-ripping-machine/automatic-ripping-machine/actions/workflows/main.yml/badge.svg)](https://github.com/automatic-ripping-machine/automatic-ripping-machine/actions/workflows/main.yml) [![Publish Docker Image](https://github.com/automatic-ripping-machine/automatic-ripping-machine/actions/workflows/publish-image.yml/badge.svg)](https://github.com/automatic-ripping-machine/automatic-ripping-machine/actions/workflows/publish-image.yml)
[![Docker](https://img.shields.io/docker/pulls/automaticrippingmachine/automatic-ripping-machine.svg)](https://hub.docker.com/r/automaticrippingmachine/automatic-ripping-machine)

[![GitHub forks](https://img.shields.io/github/forks/automatic-ripping-machine/automatic-ripping-machine)](https://github.com/automatic-ripping-machine/automatic-ripping-machine/network)
[![GitHub stars](https://img.shields.io/github/stars/automatic-ripping-machine/automatic-ripping-machine)](https://github.com/automatic-ripping-machine/automatic-ripping-machine/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/automatic-ripping-machine/automatic-ripping-machine)](https://github.com/automatic-ripping-machine/automatic-ripping-machine/issues)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/automatic-ripping-machine/automatic-ripping-machine)](https://github.com/automatic-ripping-machine/automatic-ripping-machine/pulls)
[![GitHub contributors](https://img.shields.io/github/contributors/automatic-ripping-machine/automatic-ripping-machine)](https://github.com/automatic-ripping-machine/automatic-ripping-machine/graphs/contributors)
[![GitHub last commit](https://img.shields.io/github/last-commit/automatic-ripping-machine/automatic-ripping-machine?)](https://github.com/automatic-ripping-machine/automatic-ripping-machine/commits/main)

[![GitHub license](https://img.shields.io/github/license/automatic-ripping-machine/automatic-ripping-machine)](https://github.com/automatic-ripping-machine/automatic-ripping-machine/blob/main/LICENSE)

[![GitHub release (latest by date)](https://img.shields.io/github/v/release/automatic-ripping-machine/automatic-ripping-machine?label=Latest%20Stable%20Version)](https://github.com/automatic-ripping-machine/automatic-ripping-machine/releases)
[![GitHub release Date](https://img.shields.io/github/release-date/automatic-ripping-machine/automatic-ripping-machine?label=Latest%20Stable%20Released)](https://github.com/automatic-ripping-machine/automatic-ripping-machine/releases)
![Python Versions](https://img.shields.io/badge/Python_Versions-3.9_|_3.10_|_3.11_|_3.12-blue?logo=python)



[![Wiki](https://img.shields.io/badge/Wiki-Get%20Help-brightgreen)](https://github.com/automatic-ripping-machine/automatic-ripping-machine/wiki)
[![Discord](https://img.shields.io/discord/576479573886107699)](https://discord.gg/FUSrn8jUcR)



## Overview

Insert an optical disc (Blu-ray, DVD, CD) and checks to see if it's audio, video (Movie or TV), or data, then rips it.

See: https://b3n.org/automatic-ripping-machine

## Node.js AI-First Fork

This fork includes a complete Node.js port with AI-first architecture. See [`node/README.md`](node/README.md) for full details.

**Key additions:**
- **AI-powered pipeline** — disc identification, transcode optimization, error diagnosis, and file naming all driven by LLM
- **MCP support** — ARM is both an [MCP](https://modelcontextprotocol.io) server (web UI and external apps interact with it) and MCP client (ARM uses external MCP tool servers)
- **Node.js/Express** — modern JavaScript stack with Express, Knex, better-sqlite3, EJS views

```bash
cd node && npm install
export ARM_AI_API_KEY=sk-your-key
npm run start:ui
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
    - Send notifications via IFTTT, Pushbullet, Pushover, JSON webhooks, and more!
  - If audio (CD) - rip using abcde (get disc-data and album art from [musicbrainz](https://musicbrainz.org/))
  - If data (Blu-ray, DVD, DVD-Audio or CD) - make an ISO backup
- **MCP server** — web UI and external apps interact with ARM via Model Context Protocol
- **MCP client** — ARM can use external MCP tool servers (media databases, file organizers, etc.)
- Headless, designed to be run from a server
- Can rip from multiple-optical drives in parallel
- Node.js Express web UI to interact with ripping jobs, view logs, manage AI tools and MCP apps



## Usage

- Insert disc
- Wait for disc to eject
- Repeat


## Requirements

- A system capable of running Docker containers
- One or more optical drives to rip Blu-rays, DVDs, and CDs
- Lots of drive space (I suggest using a NAS) to store your movies


## Install

[For normal installation please see the wiki](https://github.com/automatic-ripping-machine/automatic-ripping-machine/wiki/).

[For docker installation please see here](https://github.com/automatic-ripping-machine/automatic-ripping-machine/wiki/docker).

[For WSL Integration please see here]()

## Troubleshooting
 [Please see the wiki for troubleshooting](https://github.com/automatic-ripping-machine/automatic-ripping-machine/wiki/).

## Contributing

Pull requests are welcome.  Please see the [Contributing Guide](https://github.com/automatic-ripping-machine/automatic-ripping-machine/wiki/Contributing-Guide)

If you set ARM up in a different environment (hardware/OS/virtual/etc.), please consider [submitting a howto to the wiki](https://github.com/automatic-ripping-machine/automatic-ripping-machine/wiki).

## License

[MIT License](LICENSE)
