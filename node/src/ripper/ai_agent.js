/**
 * AI Agent — core intelligence layer for ARM.
 *
 * Uses an OpenAI-compatible chat completions API (configurable endpoint)
 * to intelligently parse disc labels, resolve ambiguous metadata,
 * recommend transcode settings, diagnose errors, and generate
 * media-library filenames.
 *
 * AI is a **required** component of this fork. An API key must be
 * configured via `AI_API_KEY` in arm.yaml or the `ARM_AI_API_KEY`
 * environment variable. The ripping pipeline will not start without it.
 */
const axios = require('axios');
const { execSync } = require('child_process');
const { createLogger } = require('./logger');

const logger = createLogger('ai_agent');

const MIN_CONFIDENCE_THRESHOLD = 0.5;

const DEFAULT_API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';

/**
 * Build an AI agent client from configuration.
 *
 * AI is core to this fork — a missing API key is a configuration error.
 * In validation mode (validate=true), throws an error if unconfigured.
 * In graceful mode (validate=false), returns null for backward compat
 * with tests that don't supply keys.
 */
function createAgent(config, { validate = false } = {}) {
  const apiKey = (config && config.AI_API_KEY) || process.env.ARM_AI_API_KEY || '';
  if (!apiKey) {
    if (validate) {
      throw new Error(
        'AI agent API key is required. Set AI_API_KEY in arm.yaml or ARM_AI_API_KEY environment variable.'
      );
    }
    return null;
  }
  const apiUrl = (config && config.AI_API_URL) || process.env.ARM_AI_API_URL || DEFAULT_API_URL;
  const model = (config && config.AI_MODEL) || process.env.ARM_AI_MODEL || DEFAULT_MODEL;

  return { apiKey, apiUrl, model };
}

/**
 * Require an AI agent — throws if not configured.
 * Use this at pipeline entry points to fail fast.
 */
function requireAgent(config) {
  return createAgent(config, { validate: true });
}

/**
 * Send a prompt to the AI and return the text response.
 */
async function chatCompletion(agent, messages, options = {}) {
  const { temperature = 0.2, maxTokens = 500 } = options;
  try {
    const response = await axios.post(
      agent.apiUrl,
      {
        model: agent.model,
        messages,
        temperature,
        max_tokens: maxTokens,
      },
      {
        headers: {
          'Authorization': `Bearer ${agent.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const choice = response.data && response.data.choices && response.data.choices[0];
    if (choice && choice.message && choice.message.content) {
      return choice.message.content.trim();
    }
    return null;
  } catch (err) {
    logger.warn(`AI chat completion failed: ${err.message}`);
    return null;
  }
}

/**
 * Parse a JSON response from the AI, stripping markdown code fences if present.
 */
function parseAIResponse(response) {
  if (!response) return null;
  try {
    const cleaned = response.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    logger.warn(`Failed to parse AI response as JSON: ${response}`);
    return null;
  }
}

/**
 * Ask the AI to parse a raw disc label into a clean title and year.
 *
 * Disc labels are often cryptic, like "STAR_WARS_EP_IV_DISC1" or
 * "DEADPOOL_AND_WOLVERINE". The AI can interpret these intelligently.
 */
async function parseDiscLabel(agent, rawLabel, discType) {
  if (!agent || !rawLabel) return null;

  const messages = [
    {
      role: 'system',
      content: `You are a media identification assistant. You parse disc labels from ${discType || 'video'} discs into clean movie/TV show titles. Respond ONLY with valid JSON, no markdown formatting.`,
    },
    {
      role: 'user',
      content: `Parse this disc label into a proper title:\n\nDisc label: "${rawLabel}"\nDisc type: ${discType || 'unknown'}\n\nRespond with ONLY a JSON object (no code fences) with these fields:\n- "title": the clean human-readable title\n- "year": the release year if you can determine it, otherwise empty string\n- "type": "movie" or "series"\n- "confidence": a number 0-1 indicating how confident you are`,
    },
  ];

  const response = await chatCompletion(agent, messages);
  return parseAIResponse(response);
}

/**
 * When OMDB/TMDB return multiple or uncertain results, use the AI to
 * pick the best match based on the disc label context.
 */
async function resolveAmbiguousResults(agent, rawLabel, candidates) {
  if (!agent || !candidates || candidates.length === 0) return null;

  const candidateList = candidates
    .slice(0, 10)
    .map((c, i) => `${i + 1}. "${c.title}" (${c.year || 'unknown year'}) — ${c.type || 'unknown type'}`)
    .join('\n');

  const messages = [
    {
      role: 'system',
      content: 'You are a media identification assistant. You help match disc labels to the correct metadata result. Respond ONLY with valid JSON, no markdown formatting.',
    },
    {
      role: 'user',
      content: `A disc labeled "${rawLabel}" returned these potential matches:\n\n${candidateList}\n\nWhich number is the best match? Respond with ONLY a JSON object (no code fences) with:\n- "index": the 1-based index of the best match\n- "confidence": a number 0-1`,
    },
  ];

  const response = await chatCompletion(agent, messages);
  if (!response) return null;

  const parsed = parseAIResponse(response);
  if (!parsed) return null;
  const idx = (parsed.index || 1) - 1;
  if (idx >= 0 && idx < candidates.length) {
    return { ...candidates[idx], confidence: parsed.confidence || 0 };
  }
  return null;
}

/**
 * Use AI to identify a disc when all other methods fail.
 * Provides a best-guess based on any available context.
 */
async function identifyUnknownDisc(agent, job) {
  if (!agent) return null;

  const context = [];
  if (job.label) context.push(`Disc label: "${job.label}"`);
  if (job.crc_id) context.push(`CRC ID: ${job.crc_id}`);
  if (job.disctype) context.push(`Disc type: ${job.disctype}`);
  if (job.mountpoint) context.push(`Mountpoint: ${job.mountpoint}`);

  if (context.length === 0) return null;

  const messages = [
    {
      role: 'system',
      content: 'You are a media identification assistant for optical discs (DVD, Blu-ray, CD). Use any available context to identify the disc content. Respond ONLY with valid JSON, no markdown formatting.',
    },
    {
      role: 'user',
      content: `I have a disc with the following information:\n\n${context.join('\n')}\n\nCan you identify this disc? Respond with ONLY a JSON object (no code fences) with:\n- "title": your best guess at the title\n- "year": release year if known, empty string otherwise\n- "type": "movie", "series", or "unknown"\n- "confidence": a number 0-1\n- "reasoning": brief explanation`,
    },
  ];

  const response = await chatCompletion(agent, messages);
  return parseAIResponse(response);
}

/**
 * High-level function: enhance a job's title identification using AI.
 *
 * This is the main integration point called from identify.js.
 * AI is the primary identification method in this fork:
 * 1. Always parse the raw disc label into a clean title via AI
 * 2. If no title was found at all, try to identify from context
 *
 * Returns the updated job. Logs a warning if AI is unconfigured.
 */
async function enhanceIdentification(job, config) {
  const agent = createAgent(config);
  if (!agent) {
    logger.warn('AI agent not configured — disc identification quality will be degraded. Set AI_API_KEY in config.');
    return job;
  }

  logger.info('AI agent: enhancing disc identification');

  // If we have a label but no nice title, try AI parsing
  if (job.label && !job.hasnicetitle) {
    const parsed = await parseDiscLabel(agent, job.label, job.disctype);
    if (parsed && parsed.title && (parsed.confidence || 0) >= MIN_CONFIDENCE_THRESHOLD) {
      logger.info(`AI agent parsed label "${job.label}" -> "${parsed.title}" (confidence: ${parsed.confidence})`);
      job.title = parsed.title;
      job.title_auto = parsed.title;
      if (parsed.year) {
        job.year = parsed.year;
        job.year_auto = parsed.year;
      }
      if (parsed.type) {
        job.video_type = parsed.type;
        job.video_type_auto = parsed.type;
      }
      job.hasnicetitle = true;
    }
  }

  // If still no identification, try the fallback
  if (!job.hasnicetitle && !job.title) {
    const identified = await identifyUnknownDisc(agent, job);
    if (identified && identified.title && (identified.confidence || 0) >= MIN_CONFIDENCE_THRESHOLD) {
      logger.info(`AI agent identified unknown disc as "${identified.title}" (confidence: ${identified.confidence})`);
      job.title = identified.title;
      job.title_auto = identified.title;
      if (identified.year) {
        job.year = identified.year;
        job.year_auto = identified.year;
      }
      if (identified.type && identified.type !== 'unknown') {
        job.video_type = identified.type;
        job.video_type_auto = identified.type;
      }
      job.hasnicetitle = true;
    }
  }

  return job;
}

/**
 * AI Agent: Recommend optimal transcode settings based on video metadata.
 *
 * Analyzes source video properties (resolution, codec, bitrate, audio tracks)
 * and the target configuration to suggest HandBrake/FFmpeg arguments that
 * balance quality and file size.
 */
async function recommendTranscodeSettings(agent, videoInfo, job) {
  if (!agent) return null;

  const config = job.config || {};
  const context = [];
  context.push(`Disc type: ${job.disctype || 'unknown'}`);
  context.push(`Target format: ${config.DEST_EXT || 'mkv'}`);
  context.push(`Transcoder: ${config.USE_FFMPEG ? 'FFmpeg' : 'HandBrake'}`);
  if (config.HB_PRESET_DVD) context.push(`Current DVD preset: ${config.HB_PRESET_DVD}`);
  if (config.HB_PRESET_BD) context.push(`Current Blu-ray preset: ${config.HB_PRESET_BD}`);

  if (videoInfo) {
    if (videoInfo.resolution) context.push(`Resolution: ${videoInfo.resolution}`);
    if (videoInfo.codec) context.push(`Source codec: ${videoInfo.codec}`);
    if (videoInfo.bitrate) context.push(`Source bitrate: ${videoInfo.bitrate}`);
    if (videoInfo.duration) context.push(`Duration: ${videoInfo.duration}s`);
    if (videoInfo.audioTracks) context.push(`Audio tracks: ${videoInfo.audioTracks}`);
    if (videoInfo.subtitleTracks) context.push(`Subtitle tracks: ${videoInfo.subtitleTracks}`);
  }

  const messages = [
    {
      role: 'system',
      content: 'You are a video transcoding expert. You recommend optimal settings for HandBrake and FFmpeg based on source media properties. Respond ONLY with valid JSON, no markdown formatting.',
    },
    {
      role: 'user',
      content: `Recommend optimal transcode settings for this video:\n\n${context.join('\n')}\n\nRespond with ONLY a JSON object (no code fences) with:\n- "preset": recommended HandBrake preset name (e.g. "HQ 1080p30 Surround")\n- "extraArgs": any additional CLI arguments as a string\n- "quality": recommended constant quality value (RF for HandBrake, CRF for FFmpeg)\n- "audioStrategy": how to handle audio tracks (e.g. "copy first, encode rest as AAC")\n- "reasoning": brief explanation of choices`,
    },
  ];

  const response = await chatCompletion(agent, messages);
  return parseAIResponse(response);
}

/**
 * AI Agent: Diagnose ripping or transcoding errors from log output.
 *
 * Parses error messages and log snippets to provide human-readable
 * explanations and actionable fix suggestions.
 */
async function diagnoseError(agent, errorLog, context = {}) {
  if (!agent || !errorLog) return null;

  const contextLines = [];
  if (context.phase) contextLines.push(`Phase: ${context.phase}`);
  if (context.tool) contextLines.push(`Tool: ${context.tool}`);
  if (context.disctype) contextLines.push(`Disc type: ${context.disctype}`);
  if (context.title) contextLines.push(`Title: ${context.title}`);

  // Truncate very long logs to avoid token limits
  const truncatedLog = errorLog.length > 2000
    ? errorLog.substring(errorLog.length - 2000)
    : errorLog;

  const messages = [
    {
      role: 'system',
      content: 'You are a disc ripping and video transcoding troubleshooting expert. You diagnose errors from MakeMKV, HandBrake, and FFmpeg. Respond ONLY with valid JSON, no markdown formatting.',
    },
    {
      role: 'user',
      content: `Diagnose this error:\n\n${contextLines.length > 0 ? contextLines.join('\n') + '\n\n' : ''}Error log:\n${truncatedLog}\n\nRespond with ONLY a JSON object (no code fences) with:\n- "diagnosis": clear explanation of what went wrong\n- "severity": "critical", "warning", or "info"\n- "suggestions": array of actionable fix suggestions\n- "retryable": boolean indicating if retrying might help`,
    },
  ];

  const response = await chatCompletion(agent, messages, { maxTokens: 800 });
  return parseAIResponse(response);
}

/**
 * AI Agent: Generate proper media-library filenames.
 *
 * Produces Plex/Emby/Jellyfin compatible file and folder naming for
 * movies (Title (Year)/Title (Year).ext) and TV series
 * (Show Name/Season XX/Show Name - SXXEXX - Episode Title.ext).
 */
async function generateMediaFilename(agent, job, trackInfo = {}) {
  if (!agent) return null;

  const context = [];
  if (job.title) context.push(`Title: ${job.title}`);
  if (job.year) context.push(`Year: ${job.year}`);
  if (job.video_type) context.push(`Type: ${job.video_type}`);
  if (job.label) context.push(`Disc label: ${job.label}`);
  if (job.disctype) context.push(`Disc type: ${job.disctype}`);
  if (trackInfo.trackNumber !== undefined) context.push(`Track number: ${trackInfo.trackNumber}`);
  if (trackInfo.duration) context.push(`Track duration: ${trackInfo.duration}s`);
  if (trackInfo.filename) context.push(`Original filename: ${trackInfo.filename}`);

  if (context.length === 0) return null;

  const ext = (job.config && job.config.DEST_EXT) || 'mkv';

  const messages = [
    {
      role: 'system',
      content: 'You are a media library organization expert. You generate filenames compatible with Plex, Emby, and Jellyfin naming conventions. Respond ONLY with valid JSON, no markdown formatting.',
    },
    {
      role: 'user',
      content: `Generate a proper media filename for this content:\n\n${context.join('\n')}\nFile extension: ${ext}\n\nRespond with ONLY a JSON object (no code fences) with:\n- "filename": the recommended filename (e.g. "Movie Title (2024).mkv" or "Show Name - S01E03 - Episode Title.mkv")\n- "directory": the recommended directory path relative to the media root (e.g. "movies/Movie Title (2024)" or "tv/Show Name/Season 01")\n- "confidence": a number 0-1`,
    },
  ];

  const response = await chatCompletion(agent, messages);
  return parseAIResponse(response);
}

/**
 * Collect a summary of the git history from the repository.
 *
 * Gathers commit count, date range, top contributors, release tags,
 * and a sample of milestone commits to build context for the AI.
 */
function collectGitHistory(repoPath) {
  const opts = { cwd: repoPath, encoding: 'utf8', timeout: 30000 };

  const totalCommits = execSync('git rev-list --all --count', opts).trim();

  const firstCommit = execSync('git log --all --reverse --format=%ad --date=short -1', opts).trim();
  const lastCommit = execSync('git log --all --format=%ad --date=short -1', opts).trim();

  const contributors = execSync('git shortlog -sn --all', opts)
    .trim()
    .split('\n')
    .slice(0, 15)
    .map((line) => line.trim())
    .join('\n');

  const tags = execSync('git tag --sort=version:refname', opts)
    .trim()
    .split('\n')
    .filter(Boolean);

  // Sample milestone commits: first, tag commits, and recent
  const milestoneLines = execSync(
    'git log --all --format="%ad|%an|%s" --date=short --reverse',
    opts
  ).trim().split('\n');

  // Take first 5, last 10, and evenly spaced samples from the middle
  const samples = [];
  samples.push(...milestoneLines.slice(0, 5));
  if (milestoneLines.length > 50) {
    const step = Math.floor(milestoneLines.length / 20);
    for (let i = step; i < milestoneLines.length - 10; i += step) {
      samples.push(milestoneLines[i]);
    }
  }
  samples.push(...milestoneLines.slice(-10));
  // Deduplicate while preserving order
  const seen = new Set();
  const uniqueSamples = samples.filter((s) => {
    if (seen.has(s)) return false;
    seen.add(s);
    return true;
  });

  return {
    totalCommits,
    firstCommit,
    lastCommit,
    contributors,
    tags,
    sampleCommits: uniqueSamples,
  };
}

/**
 * AI Agent: Tell the story of the project based on its complete git history.
 *
 * Collects git history metadata (commits, contributors, tags, milestones)
 * and asks the AI to generate a narrative telling the project's story.
 */
async function tellStory(agent, repoPath) {
  if (!agent) return null;

  let history;
  try {
    history = collectGitHistory(repoPath);
  } catch (err) {
    logger.warn(`Failed to collect git history: ${err.message}`);
    return null;
  }

  const tagList = history.tags.length > 0
    ? history.tags.join(', ')
    : 'none';

  const sampleList = history.sampleCommits
    .map((s) => `  - ${s}`)
    .join('\n');

  const messages = [
    {
      role: 'system',
      content: 'You are a storyteller who writes engaging narratives about software projects based on their git history. Write in a warm, human tone. Focus on the journey: who built it, how it evolved, major milestones, and what makes the project interesting.',
    },
    {
      role: 'user',
      content: `Tell the story of this software project based on its git history:\n\nTotal commits: ${history.totalCommits}\nFirst commit: ${history.firstCommit}\nMost recent commit: ${history.lastCommit}\n\nTop contributors:\n${history.contributors}\n\nRelease tags: ${tagList}\n\nMilestone commits (sampled):\n${sampleList}\n\nWrite a compelling narrative (3-5 paragraphs) telling the story of this project from birth to present. Highlight the key phases of development, notable contributors, and how the project has evolved over time.`,
    },
  ];

  const response = await chatCompletion(agent, messages, { temperature: 0.7, maxTokens: 1500 });
  return response;
}

module.exports = {
  createAgent,
  requireAgent,
  chatCompletion,
  parseAIResponse,
  parseDiscLabel,
  resolveAmbiguousResults,
  identifyUnknownDisc,
  enhanceIdentification,
  recommendTranscodeSettings,
  diagnoseError,
  generateMediaFilename,
  tellStory,
  collectGitHistory,
  DEFAULT_API_URL,
  DEFAULT_MODEL,
  MIN_CONFIDENCE_THRESHOLD,
};
