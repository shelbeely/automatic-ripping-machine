# API Reference

ARM exposes a REST API for managing jobs, accessing AI capabilities, and interacting with MCP apps. All endpoints are served from the Express web server (default port 8080).

## Authentication

API requests require an authenticated session. Log in via the web UI or POST to `/login` first.

## Response Format

All API endpoints return JSON with a consistent format:

```json
{
  "success": true,
  "data": { ... }
}
```

On error:

```json
{
  "success": false,
  "error": "Error description"
}
```

## Job Management

### List Jobs

```
GET /api/jobs
GET /api/jobs?status=active
GET /api/jobs?status=completed
GET /api/jobs?status=failed
```

**Response:**
```json
{
  "success": true,
  "jobs": [
    {
      "id": 1,
      "title": "Star Wars",
      "status": "active",
      "progress": 45,
      "disc_type": "bluray",
      "start_time": "2026-02-12T01:00:00Z"
    }
  ]
}
```

### Get Job Detail

```
GET /api/jobs/:id
```

**Response:**
```json
{
  "success": true,
  "job": { ... },
  "tracks": [ ... ]
}
```

### Delete Job

```
DELETE /api/jobs/:id
```

### Abandon Job

```
POST /api/jobs/:id/abandon
```

### Search Jobs

```
GET /api/search?q=star+wars
```

## AI Endpoints

### Identify Disc

Parse a raw disc label into a clean title, year, and type.

```
POST /api/ai/identify
Content-Type: application/json

{
  "label": "STAR_WARS_EP_IV_A_NEW_HOPE",
  "discType": "bluray"
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "title": "Star Wars: Episode IV - A New Hope",
    "year": 1977,
    "type": "movie",
    "confidence": 0.95
  }
}
```

### Diagnose Error

Analyze a rip/transcode error log and provide diagnosis.

```
POST /api/ai/diagnose
Content-Type: application/json

{
  "errorLog": "MakeMKV error: scsi error - MEDIUM ERROR:L-EC UNCORRECTABLE ERROR...",
  "context": "ripping"
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "problem": "Disc has physical damage causing read errors",
    "severity": "high",
    "suggestions": [
      "Clean the disc surface",
      "Try a different optical drive",
      "Reduce MakeMKV read retry count"
    ],
    "retryRecommended": false
  }
}
```

### Recommend Transcode Settings

Get AI-optimized HandBrake/FFmpeg settings for a specific video.

```
POST /api/ai/transcode
Content-Type: application/json

{
  "videoInfo": {
    "resolution": "1920x1080",
    "codec": "h264",
    "bitrate": "25000",
    "audioTracks": 3,
    "subtitleTracks": 2
  }
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "encoder": "x265",
    "quality": 20,
    "preset": "slow",
    "audioCodec": "aac",
    "audioBitrate": "192k",
    "additionalFlags": "--all-subtitles"
  }
}
```

### Generate Media Filename

Generate Plex/Emby/Jellyfin-compatible filenames and directory structures.

```
POST /api/ai/filename
Content-Type: application/json

{
  "title": "Star Wars: Episode IV - A New Hope",
  "year": 1977,
  "type": "movie"
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "filename": "Star Wars Episode IV - A New Hope (1977).mkv",
    "directory": "Movies/Star Wars Episode IV - A New Hope (1977)"
  }
}
```

## MCP Endpoints

### List MCP Tools

List all tools from all connected MCP apps.

```
GET /api/mcp/tools
```

**Response:**
```json
{
  "success": true,
  "tools": [
    {
      "appName": "media-db",
      "name": "search_movie",
      "description": "Search for a movie in the database",
      "inputSchema": { ... }
    }
  ]
}
```

### Call MCP Tool

Call a tool on a specific connected MCP app.

```
POST /api/mcp/call
Content-Type: application/json

{
  "appName": "media-db",
  "toolName": "search_movie",
  "arguments": { "query": "Star Wars" }
}
```

**Response:**
```json
{
  "success": true,
  "result": { ... }
}
```

## MCP Server Endpoint

ARM's built-in MCP server accepts JSON-RPC 2.0 requests:

```
POST /mcp/message
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}
```

See [MCP Integration](MCP-Integration) for full MCP server documentation.

## Configuration

### Update Job Config

```
PUT /api/config/:id
Content-Type: application/json

{ ... config fields ... }
```

## Notifications

### Get Notifications

```
GET /api/notifications
```

**Response:**
```json
{
  "success": true,
  "notifications": [
    {
      "id": 1,
      "message": "Rip completed: Star Wars",
      "seen": false,
      "created_at": "2026-02-12T01:30:00Z"
    }
  ]
}
```

## Logs

### Get Job Logs

```
GET /api/logs/:jobId
GET /api/logs/:jobId?lines=100
```
