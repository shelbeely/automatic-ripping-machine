# Node.js Installation

This guide covers installing the Node.js AI-first version of ARM on a Linux system.

## Prerequisites

### System Requirements

- **Linux**: Any modern Linux distribution (Ubuntu 22.04+, Debian 12+, Fedora 38+, etc.)
- **Node.js**: Version 18 or later (LTS recommended)
- **npm**: Comes with Node.js

### System Dependencies

ARM still uses the same system tools for disc ripping and transcoding. Install these first:

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y makemkv-bin makemkv-oss handbrake-cli abcde \
  libdvd-pkg cdparanoia flac lame eject at

# For Blu-ray support
sudo dpkg-reconfigure libdvd-pkg
```

### AI API Key (Required)

ARM requires an OpenAI-compatible API key. Get one from:
- [OpenAI](https://platform.openai.com/api-keys) — Recommended (`gpt-4o-mini`)
- [Ollama](https://ollama.ai) — Free, runs locally
- [LM Studio](https://lmstudio.ai) — Free, runs locally
- Any OpenAI-compatible provider

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/shelbeely/automatic-ripping-machine.git
cd automatic-ripping-machine/node
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure ARM

Create the ARM config directory:

```bash
sudo mkdir -p /etc/arm/config
sudo cp ../arm.yaml /etc/arm/config/arm.yaml
```

Edit `/etc/arm/config/arm.yaml` to set your preferences. At minimum, configure:

```yaml
# Required: AI configuration
AI_API_KEY: "sk-your-api-key"
AI_API_URL: "https://api.openai.com/v1/chat/completions"
AI_MODEL: "gpt-4o-mini"

# Recommended: metadata APIs
OMDB_API_KEY: "your-omdb-key"

# Directories
ARMPATH: "/home/arm"
RAWPATH: "/home/arm/raw"
MEDIA_DIR: "/home/arm/media"
COMPLETED_PATH: "/home/arm/media/completed"
```

Or use environment variables:

```bash
export ARM_AI_API_KEY=sk-your-api-key
export ARM_OMDB_API_KEY=your-omdb-key
```

### 4. Start ARM

```bash
# Start the web UI
npm run start:ui

# Or start the full ARM daemon (web UI + disc watcher)
npm start
```

Visit `http://localhost:8080` in your browser.

### 5. (Optional) Set Up as a Service

Create a systemd service for ARM:

```bash
sudo tee /etc/systemd/system/arm.service << 'EOF'
[Unit]
Description=Automatic Ripping Machine (ARM)
After=network.target

[Service]
Type=simple
User=arm
WorkingDirectory=/opt/automatic-ripping-machine/node
Environment=ARM_AI_API_KEY=sk-your-api-key
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable arm
sudo systemctl start arm
```

### 6. (Optional) Configure MCP Apps

If you want ARM to use external MCP tool servers, add them to `arm.yaml`:

```yaml
MCP_APPS:
  - name: "media-db"
    command: "npx"
    args: ["-y", "@some/media-db-mcp-server"]
```

See [MCP Integration](MCP-Integration) for details.

## Verification

After starting ARM, verify everything works:

1. **Web UI**: Visit `http://localhost:8080` — you should see the ARM dashboard
2. **AI Agent**: Check logs for `AI agent configured with model gpt-4o-mini`
3. **API**: `curl http://localhost:8080/api/jobs` should return `{"success":true,"jobs":[]}`
4. **MCP**: `curl -X POST http://localhost:8080/mcp/message -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'` should list available tools

## Running Tests

```bash
cd node
npm test
```

All 145+ tests should pass.

## Upgrading

```bash
cd automatic-ripping-machine
git pull
cd node
npm install
sudo systemctl restart arm  # if using systemd
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `AI_API_KEY is required` | Set your API key in `arm.yaml` or `ARM_AI_API_KEY` env var |
| `Cannot find module 'better-sqlite3'` | Run `npm install` — native modules need to be built for your system |
| MakeMKV not found | Install MakeMKV: `sudo apt install makemkv-bin makemkv-oss` |
| Port 8080 in use | Set `ARM_UI_PORT=8081` or change `PORT` in config |
| MCP app won't connect | Check the app command and args; run the command manually to test |
