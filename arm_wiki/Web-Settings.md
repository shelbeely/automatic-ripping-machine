# ARM Settings

<!-- TOC -->
* [ARM Settings](#arm-settings)
  * [Overview](#overview)
  * [Settings](#settings)
    * [General Info](#general-info)
    * [System Info](#system-info)
    * [AI Configuration](#ai-configuration)
    * [MCP Apps](#mcp-apps)
    * [abcde Config](#abcde-config)
    * [Ripper Settings](#ripper-settings)
    * [UI Settings](#ui-settings)
    * [Notifications](#notifications)
<!-- TOC -->

## Overview

The ARM Settings page provides an overview of the system state, management of drives, AI configuration, MCP apps, and ARM configuration settings.

## Settings

### General Info

The General Info tab provides a high level summary of 'Server Details' and 'Disk Drives'.
See [Settings Drives](Web-Settings-Drives) on drive management.

The Server Details provide:
- Date and time info:
  - Datetime, the current date and time of the ARM Server
  - Timezone, the timezone configured for your server
- System versions:
  - Node.js Version, the Node.js version running ARM
  - ARM version, the current version running on the server
  - Current Git Version, the current git commit running on the server
- Ripping Stats:
  - Total rips, total rips managed by ARM
  - Movies, total count of movies ripped
  - Series, total count of TV series ripped
  - Audio, total count of Music CDs ripped


### System Info

The System Info tab provides an overview of the current ARM server state including CPU, memory, and storage information.


### AI Configuration

The AI Configuration section shows the current AI agent setup:
- **API URL**: The OpenAI-compatible endpoint being used
- **Model**: The AI model in use (e.g., `gpt-4o-mini`)
- **Status**: Whether the AI agent is properly configured and responding

AI is a core requirement for this fork. See [AI Agent](AI-Agent) for configuration details.


### MCP Apps

The MCP Apps section shows connected MCP tool servers:
- **Status**: Connected/disconnected for each configured app
- **Tools**: Available tools from each connected app

Accessible via **AI Tools > MCP Apps** in the navigation. See [MCP Integration](MCP-Integration) for configuration details.


### abcde Config

The .abcde Config configures how ARM handles Music discs.
ARM doesn't carry out any Music ripping, but passes the job off to the [.abcde package](https://abcde.einval.com/wiki/).

More info can be found on the [.abcde config](Config-abcde.conf) page.


### Ripper Settings

The Ripper Settings are the backbone of the ARM experience.
These configuration settings provide flexibility to back up, rip, transcode or ignore discs all together.

More info can be found on the [ARM config](Config-arm.yaml) page.


### UI Settings

The ARM UI settings adjust the presentation, alert duration and layout of the ARM web pages.

More info can be found on the [UI Settings](Web-Settings-UI) page.


### Notifications

ARM supports sending notifications via multiple channels:
- **PushBullet** — Push notifications to devices
- **IFTTT** — Trigger webhooks for automation
- **Pushover** — Push notifications with priority support
- **JSON Webhooks** — Send JSON payloads to any URL (Discord, Slack, etc.)

Configure notification settings in `arm.yaml`. See [Configuring ARM](Configuring-ARM) for details.
