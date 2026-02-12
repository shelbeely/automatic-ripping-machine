# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 3.x (Node.js) | :white_check_mark: |
| < 3.0 (Python) | :x:                |

## Reporting a Vulnerability

Please open an issue as with other requests.
Use [security] in your issue title — this makes things easier and it can be looked at sooner.

## AI API Security

ARM sends disc labels and error logs to an AI API for processing. Be aware that:
- Your `AI_API_KEY` is sensitive — never commit it to source control
- Use environment variables (`ARM_AI_API_KEY`) rather than putting keys in config files that might be shared
- If using a local AI provider (Ollama, LM Studio), no data leaves your network
- ARM redacts API keys from config resources exposed via MCP
