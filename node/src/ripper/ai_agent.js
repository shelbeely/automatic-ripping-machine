/**
 * AI Agent for disc title identification and metadata resolution.
 *
 * Uses an OpenAI-compatible chat completions API (configurable endpoint)
 * to intelligently parse disc labels, resolve ambiguous metadata, and
 * provide fallback identification when OMDB/TMDB lookups fail.
 *
 * The agent is completely optional — if no API key is configured, the
 * ripping pipeline falls back to the standard OMDB/TMDB identification.
 */
const axios = require('axios');
const { createLogger } = require('./logger');

const logger = createLogger('ai_agent');

const DEFAULT_API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';

/**
 * Build an AI agent client from configuration.
 * Returns null if no API key is set.
 */
function createAgent(config) {
  const apiKey = (config && config.AI_API_KEY) || process.env.ARM_AI_API_KEY || '';
  if (!apiKey) {
    return null;
  }
  const apiUrl = (config && config.AI_API_URL) || process.env.ARM_AI_API_URL || DEFAULT_API_URL;
  const model = (config && config.AI_MODEL) || process.env.ARM_AI_MODEL || DEFAULT_MODEL;

  return { apiKey, apiUrl, model };
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
  if (!response) return null;

  try {
    // Strip markdown code fences if present
    const cleaned = response.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    logger.warn(`Failed to parse AI response as JSON: ${response}`);
    return null;
  }
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

  try {
    const cleaned = response.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);
    const idx = (parsed.index || 1) - 1;
    if (idx >= 0 && idx < candidates.length) {
      return { ...candidates[idx], confidence: parsed.confidence || 0 };
    }
  } catch (err) {
    logger.warn(`Failed to parse AI disambiguation response: ${response}`);
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
  if (!response) return null;

  try {
    const cleaned = response.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    logger.warn(`Failed to parse AI identification response: ${response}`);
    return null;
  }
}

/**
 * High-level function: enhance a job's title identification using AI.
 *
 * This is the main integration point called from identify.js.
 * It tries to improve the title in several ways:
 * 1. Parse the raw disc label into a clean title
 * 2. If no title was found at all, try to identify from context
 *
 * Returns the updated job, or the original job if AI is unavailable.
 */
async function enhanceIdentification(job, config) {
  const agent = createAgent(config);
  if (!agent) {
    logger.debug('AI agent not configured, skipping enhancement');
    return job;
  }

  logger.info('AI agent: enhancing disc identification');

  // If we have a label but no nice title, try AI parsing
  if (job.label && !job.hasnicetitle) {
    const parsed = await parseDiscLabel(agent, job.label, job.disctype);
    if (parsed && parsed.title && (parsed.confidence || 0) >= 0.5) {
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
    if (identified && identified.title && (identified.confidence || 0) >= 0.5) {
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

module.exports = {
  createAgent,
  chatCompletion,
  parseDiscLabel,
  resolveAmbiguousResults,
  identifyUnknownDisc,
  enhanceIdentification,
  DEFAULT_API_URL,
  DEFAULT_MODEL,
};
