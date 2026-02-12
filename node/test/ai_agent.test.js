const {
  createAgent,
  chatCompletion,
  parseAIResponse,
  parseDiscLabel,
  resolveAmbiguousResults,
  identifyUnknownDisc,
  enhanceIdentification,
  DEFAULT_API_URL,
  DEFAULT_MODEL,
  MIN_CONFIDENCE_THRESHOLD,
} = require('../src/ripper/ai_agent');

// Mock axios for all tests
jest.mock('axios');
const axios = require('axios');

describe('AI Agent', () => {
  describe('createAgent', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
      delete process.env.ARM_AI_API_KEY;
      delete process.env.ARM_AI_API_URL;
      delete process.env.ARM_AI_MODEL;
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    test('should return null when no API key is configured', () => {
      const agent = createAgent({});
      expect(agent).toBeNull();
    });

    test('should create agent from config', () => {
      const agent = createAgent({ AI_API_KEY: 'test-key-123' });
      expect(agent).not.toBeNull();
      expect(agent.apiKey).toBe('test-key-123');
      expect(agent.apiUrl).toBe(DEFAULT_API_URL);
      expect(agent.model).toBe(DEFAULT_MODEL);
    });

    test('should create agent from environment variables', () => {
      process.env.ARM_AI_API_KEY = 'env-key-456';
      process.env.ARM_AI_API_URL = 'https://custom.api/v1/chat';
      process.env.ARM_AI_MODEL = 'gpt-4';
      const agent = createAgent({});
      expect(agent).not.toBeNull();
      expect(agent.apiKey).toBe('env-key-456');
      expect(agent.apiUrl).toBe('https://custom.api/v1/chat');
      expect(agent.model).toBe('gpt-4');
    });

    test('should prefer config over environment', () => {
      process.env.ARM_AI_API_KEY = 'env-key';
      const agent = createAgent({ AI_API_KEY: 'config-key' });
      expect(agent.apiKey).toBe('config-key');
    });

    test('should use custom API URL and model from config', () => {
      const agent = createAgent({
        AI_API_KEY: 'key',
        AI_API_URL: 'https://my-llm.example.com/v1/chat/completions',
        AI_MODEL: 'llama-3',
      });
      expect(agent.apiUrl).toBe('https://my-llm.example.com/v1/chat/completions');
      expect(agent.model).toBe('llama-3');
    });
  });

  describe('chatCompletion', () => {
    test('should return response text on success', async () => {
      axios.post.mockResolvedValueOnce({
        data: {
          choices: [{ message: { content: 'Hello world' } }],
        },
      });

      const agent = { apiKey: 'key', apiUrl: DEFAULT_API_URL, model: DEFAULT_MODEL };
      const result = await chatCompletion(agent, [{ role: 'user', content: 'test' }]);
      expect(result).toBe('Hello world');
    });

    test('should return null on API error', async () => {
      axios.post.mockRejectedValueOnce(new Error('API error'));

      const agent = { apiKey: 'key', apiUrl: DEFAULT_API_URL, model: DEFAULT_MODEL };
      const result = await chatCompletion(agent, [{ role: 'user', content: 'test' }]);
      expect(result).toBeNull();
    });

    test('should return null for malformed response', async () => {
      axios.post.mockResolvedValueOnce({ data: {} });

      const agent = { apiKey: 'key', apiUrl: DEFAULT_API_URL, model: DEFAULT_MODEL };
      const result = await chatCompletion(agent, [{ role: 'user', content: 'test' }]);
      expect(result).toBeNull();
    });

    test('should send correct request format', async () => {
      axios.post.mockResolvedValueOnce({
        data: { choices: [{ message: { content: 'ok' } }] },
      });

      const agent = { apiKey: 'my-key', apiUrl: 'https://api.test/chat', model: 'test-model' };
      await chatCompletion(agent, [{ role: 'user', content: 'test' }], {
        temperature: 0.5,
        maxTokens: 100,
      });

      expect(axios.post).toHaveBeenCalledWith(
        'https://api.test/chat',
        expect.objectContaining({
          model: 'test-model',
          messages: [{ role: 'user', content: 'test' }],
          temperature: 0.5,
          max_tokens: 100,
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer my-key',
          }),
        })
      );
    });
  });

  describe('parseAIResponse', () => {
    test('should parse valid JSON', () => {
      const result = parseAIResponse('{"title": "Test", "year": "2024"}');
      expect(result).toEqual({ title: 'Test', year: '2024' });
    });

    test('should strip markdown code fences', () => {
      const result = parseAIResponse('```json\n{"title": "Test"}\n```');
      expect(result).toEqual({ title: 'Test' });
    });

    test('should return null for null input', () => {
      expect(parseAIResponse(null)).toBeNull();
    });

    test('should return null for invalid JSON', () => {
      expect(parseAIResponse('not json')).toBeNull();
    });
  });

  describe('constants', () => {
    test('MIN_CONFIDENCE_THRESHOLD should be 0.5', () => {
      expect(MIN_CONFIDENCE_THRESHOLD).toBe(0.5);
    });
  });

  describe('parseDiscLabel', () => {
    test('should return null when agent is null', async () => {
      const result = await parseDiscLabel(null, 'STAR_WARS', 'dvd');
      expect(result).toBeNull();
    });

    test('should return null when label is empty', async () => {
      const agent = { apiKey: 'key', apiUrl: DEFAULT_API_URL, model: DEFAULT_MODEL };
      const result = await parseDiscLabel(agent, '', 'dvd');
      expect(result).toBeNull();
    });

    test('should parse disc label successfully', async () => {
      const mockResponse = JSON.stringify({
        title: 'Star Wars: Episode IV - A New Hope',
        year: '1977',
        type: 'movie',
        confidence: 0.95,
      });

      axios.post.mockResolvedValueOnce({
        data: { choices: [{ message: { content: mockResponse } }] },
      });

      const agent = { apiKey: 'key', apiUrl: DEFAULT_API_URL, model: DEFAULT_MODEL };
      const result = await parseDiscLabel(agent, 'STAR_WARS_EP_IV_A_NEW_HOPE', 'dvd');

      expect(result).not.toBeNull();
      expect(result.title).toBe('Star Wars: Episode IV - A New Hope');
      expect(result.year).toBe('1977');
      expect(result.type).toBe('movie');
      expect(result.confidence).toBe(0.95);
    });

    test('should handle markdown-wrapped JSON response', async () => {
      const mockResponse = '```json\n{"title": "Inception", "year": "2010", "type": "movie", "confidence": 0.9}\n```';

      axios.post.mockResolvedValueOnce({
        data: { choices: [{ message: { content: mockResponse } }] },
      });

      const agent = { apiKey: 'key', apiUrl: DEFAULT_API_URL, model: DEFAULT_MODEL };
      const result = await parseDiscLabel(agent, 'INCEPTION_DISC1', 'bluray');

      expect(result).not.toBeNull();
      expect(result.title).toBe('Inception');
    });

    test('should return null for unparseable AI response', async () => {
      axios.post.mockResolvedValueOnce({
        data: { choices: [{ message: { content: 'I think this is Star Wars' } }] },
      });

      const agent = { apiKey: 'key', apiUrl: DEFAULT_API_URL, model: DEFAULT_MODEL };
      const result = await parseDiscLabel(agent, 'STAR_WARS', 'dvd');
      expect(result).toBeNull();
    });
  });

  describe('resolveAmbiguousResults', () => {
    test('should return null when agent is null', async () => {
      const result = await resolveAmbiguousResults(null, 'label', []);
      expect(result).toBeNull();
    });

    test('should return null for empty candidates', async () => {
      const agent = { apiKey: 'key', apiUrl: DEFAULT_API_URL, model: DEFAULT_MODEL };
      const result = await resolveAmbiguousResults(agent, 'label', []);
      expect(result).toBeNull();
    });

    test('should pick the best candidate', async () => {
      const candidates = [
        { title: 'The Matrix', year: '1999', type: 'movie' },
        { title: 'The Matrix Reloaded', year: '2003', type: 'movie' },
        { title: 'The Matrix Revolutions', year: '2003', type: 'movie' },
      ];

      axios.post.mockResolvedValueOnce({
        data: {
          choices: [{ message: { content: '{"index": 1, "confidence": 0.95}' } }],
        },
      });

      const agent = { apiKey: 'key', apiUrl: DEFAULT_API_URL, model: DEFAULT_MODEL };
      const result = await resolveAmbiguousResults(agent, 'THE_MATRIX', candidates);

      expect(result).not.toBeNull();
      expect(result.title).toBe('The Matrix');
      expect(result.confidence).toBe(0.95);
    });
  });

  describe('identifyUnknownDisc', () => {
    test('should return null when agent is null', async () => {
      const result = await identifyUnknownDisc(null, {});
      expect(result).toBeNull();
    });

    test('should return null when no context is available', async () => {
      const agent = { apiKey: 'key', apiUrl: DEFAULT_API_URL, model: DEFAULT_MODEL };
      const result = await identifyUnknownDisc(agent, {});
      expect(result).toBeNull();
    });

    test('should identify disc from context', async () => {
      const mockResponse = JSON.stringify({
        title: 'The Dark Knight',
        year: '2008',
        type: 'movie',
        confidence: 0.8,
        reasoning: 'Label matches The Dark Knight disc pattern',
      });

      axios.post.mockResolvedValueOnce({
        data: { choices: [{ message: { content: mockResponse } }] },
      });

      const agent = { apiKey: 'key', apiUrl: DEFAULT_API_URL, model: DEFAULT_MODEL };
      const job = { label: 'DARK_KNIGHT', disctype: 'bluray' };
      const result = await identifyUnknownDisc(agent, job);

      expect(result).not.toBeNull();
      expect(result.title).toBe('The Dark Knight');
      expect(result.year).toBe('2008');
    });
  });

  describe('enhanceIdentification', () => {
    test('should skip when no API key configured', async () => {
      const job = { label: 'TEST', hasnicetitle: false, title: '' };
      const result = await enhanceIdentification(job, {});
      expect(result).toBe(job);
    });

    test('should enhance job from disc label', async () => {
      const mockResponse = JSON.stringify({
        title: 'Jurassic Park',
        year: '1993',
        type: 'movie',
        confidence: 0.9,
      });

      axios.post.mockResolvedValueOnce({
        data: { choices: [{ message: { content: mockResponse } }] },
      });

      const job = {
        label: 'JURASSIC_PARK',
        hasnicetitle: false,
        title: 'JURASSIC PARK',
        disctype: 'dvd',
      };
      const config = { AI_API_KEY: 'test-key' };
      const result = await enhanceIdentification(job, config);

      expect(result.title).toBe('Jurassic Park');
      expect(result.year).toBe('1993');
      expect(result.hasnicetitle).toBe(true);
    });

    test('should skip low-confidence results', async () => {
      const mockResponse = JSON.stringify({
        title: 'Maybe Something',
        year: '',
        type: 'movie',
        confidence: 0.3,
      });

      axios.post.mockResolvedValueOnce({
        data: { choices: [{ message: { content: mockResponse } }] },
      });

      const job = {
        label: 'UNKNOWN_DISC',
        hasnicetitle: false,
        title: '',
        disctype: 'dvd',
      };
      const config = { AI_API_KEY: 'test-key' };
      const result = await enhanceIdentification(job, config);

      expect(result.hasnicetitle).toBeFalsy();
    });

    test('should not override existing nice title', async () => {
      const job = {
        label: 'SOME_LABEL',
        hasnicetitle: true,
        title: 'Already Identified',
      };
      const config = { AI_API_KEY: 'test-key' };
      const result = await enhanceIdentification(job, config);

      // enhanceIdentification checks !job.hasnicetitle before calling AI
      expect(result.title).toBe('Already Identified');
    });
  });
});
