# AI Agent

AI is a **core component** of the ARM Node.js fork — it is not optional. ARM uses an OpenAI-compatible LLM to power four key capabilities in the ripping pipeline.

## Setup

### 1. Get an API Key

ARM works with any OpenAI-compatible API provider:

| Provider | Model | Notes |
|----------|-------|-------|
| [OpenAI](https://platform.openai.com/api-keys) | `gpt-4o-mini` | Recommended default — good balance of cost and quality |
| [OpenAI](https://platform.openai.com/api-keys) | `gpt-4o` | Higher quality, higher cost |
| [Ollama](https://ollama.ai) | Any model | Free, local — set `AI_API_URL` to `http://localhost:11434/v1/chat/completions` |
| [LM Studio](https://lmstudio.ai) | Any model | Free, local — set `AI_API_URL` to `http://localhost:1234/v1/chat/completions` |
| Any OpenAI-compatible API | Varies | Set `AI_API_URL` to the provider's chat completions endpoint |

### 2. Configure

**Via `arm.yaml`:**

```yaml
AI_API_KEY: "sk-your-api-key-here"
AI_API_URL: "https://api.openai.com/v1/chat/completions"  # default
AI_MODEL: "gpt-4o-mini"  # default
```

**Via environment variables** (override `arm.yaml`):

```bash
export ARM_AI_API_KEY=sk-your-api-key-here
export ARM_AI_API_URL=https://api.openai.com/v1/chat/completions
export ARM_AI_MODEL=gpt-4o-mini
```

### 3. Verify

Start ARM and check the logs. If AI is properly configured, you'll see:

```
info: AI agent configured with model gpt-4o-mini
```

If the API key is missing, ARM will fail to start with a clear error message.

## AI Capabilities

### 1. Disc Identification (`parseDiscLabel`)

When a disc is inserted, ARM reads the raw disc label (e.g., `STAR_WARS_EP_IV_A_NEW_HOPE`) and uses AI to extract:

- **Title**: "Star Wars: Episode IV - A New Hope"
- **Year**: 1977
- **Type**: "movie" or "series"

This is used as the primary identification method. OMDb/TMDB APIs serve as validation/fallback.

**API endpoint:** `POST /api/ai/identify`

```json
{
  "label": "STAR_WARS_EP_IV_A_NEW_HOPE",
  "discType": "bluray"
}
```

### 2. Transcode Optimization (`recommendTranscodeSettings`)

Before transcoding, ARM sends the video's metadata (resolution, codec, bitrate, audio/subtitle tracks) to the AI, which recommends optimal HandBrake or FFmpeg settings tailored to the specific source.

**API endpoint:** `POST /api/ai/transcode`

```json
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

### 3. Error Diagnosis (`diagnoseError`)

When a rip or transcode fails, ARM sends the error log to AI for analysis. The AI returns:

- **Problem**: Human-readable description of what went wrong
- **Severity**: "low", "medium", "high", or "critical"
- **Suggestions**: Actionable fix recommendations
- **Retry**: Whether retrying is likely to help

**API endpoint:** `POST /api/ai/diagnose`

```json
{
  "errorLog": "MakeMKV: Error reading sector 12345...",
  "context": "ripping"
}
```

### 4. File Naming (`generateMediaFilename`)

After ripping, ARM uses AI to generate Plex/Emby/Jellyfin-compatible filenames and directory structures:

- **Movies**: `Movies/Star Wars Episode IV - A New Hope (1977)/Star Wars Episode IV - A New Hope (1977).mkv`
- **TV Series**: `TV/Breaking Bad/Season 01/Breaking Bad - S01E01 - Pilot.mkv`

**API endpoint:** `POST /api/ai/filename`

```json
{
  "title": "Star Wars: Episode IV - A New Hope",
  "year": 2977,
  "type": "movie"
}
```

## Architecture

The AI agent module lives at `node/src/ripper/ai_agent.js` and exports:

| Function | Purpose |
|----------|---------|
| `createAgent(config)` | Create AI client (returns `null` if not configured — use within running jobs) |
| `requireAgent(config)` | Create AI client or throw if not configured — use at startup/entry points |
| `chatCompletion(agent, prompt)` | Send prompt to AI API |
| `parseDiscLabel(agent, label, discType)` | Identify disc from raw label |
| `recommendTranscodeSettings(agent, videoInfo)` | Get optimal transcode settings |
| `diagnoseError(agent, errorLog, context)` | Analyze error logs |
| `generateMediaFilename(agent, title, year, type)` | Generate media-library filenames |

### Entry Points

- **Pipeline entry** (`main.js`): Uses `requireAgent()` to validate AI config at startup. ARM will not start without a valid AI configuration.
- **Within running jobs** (`arm_ripper.js`, `utils.js`): Uses `createAgent()` for graceful degradation — if AI fails mid-job, the job continues with fallback behavior and logs a warning.

## Testing

AI agent tests mock the HTTP client (`axios`) to avoid real API calls:

```bash
cd node
npx jest test/ai_agent.test.js --forceExit
```
