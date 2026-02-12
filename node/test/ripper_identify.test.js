const {
  parseMcpToolResultText,
  parseOmdbMcpDetails,
  getVideoDetailsMcp,
} = require('../src/ripper/identify');

describe('Ripper Identify - MCP Integration', () => {
  describe('parseMcpToolResultText', () => {
    test('should return null for null input', () => {
      expect(parseMcpToolResultText(null)).toBeNull();
    });

    test('should return null for result without content', () => {
      expect(parseMcpToolResultText({})).toBeNull();
      expect(parseMcpToolResultText({ content: [] })).toBeNull();
    });

    test('should extract text from MCP tool result', () => {
      const result = {
        content: [
          { type: 'text', text: 'Hello World' },
        ],
      };
      expect(parseMcpToolResultText(result)).toBe('Hello World');
    });

    test('should join multiple text parts', () => {
      const result = {
        content: [
          { type: 'text', text: 'Line 1' },
          { type: 'text', text: 'Line 2' },
        ],
      };
      expect(parseMcpToolResultText(result)).toBe('Line 1\nLine 2');
    });

    test('should ignore non-text content types', () => {
      const result = {
        content: [
          { type: 'image', data: 'base64' },
          { type: 'text', text: 'Only text' },
        ],
      };
      expect(parseMcpToolResultText(result)).toBe('Only text');
    });
  });

  describe('parseOmdbMcpDetails', () => {
    test('should return null for null input', () => {
      expect(parseOmdbMcpDetails(null)).toBeNull();
    });

    test('should return null for empty string', () => {
      expect(parseOmdbMcpDetails('')).toBeNull();
    });

    test('should parse OMDB MCP movie details text', () => {
      const text = [
        '🎬 The Dark Knight (2008)',
        '',
        'IMDB ID: tt0468569',
        'Rating: PG-13',
        'Runtime: 152 min',
        'Genre: Action, Crime, Drama',
        'Director: Christopher Nolan',
        'Cast: Christian Bale, Heath Ledger, Aaron Eckhart',
        'IMDB Rating: 9.0/10',
        'Metacritic Score: 84/100',
        '',
        'Plot:',
        'When the menace known as the Joker wreaks havoc.',
        '',
        'Awards: Won 2 Oscars.',
      ].join('\n');

      const result = parseOmdbMcpDetails(text);
      expect(result).not.toBeNull();
      expect(result.Title).toBe('The Dark Knight');
      expect(result.Year).toBe('2008');
      expect(result['IMDB ID']).toBe('tt0468569');
      expect(result.Rating).toBe('PG-13');
      expect(result.Genre).toBe('Action, Crime, Drama');
      expect(result.Director).toBe('Christopher Nolan');
    });

    test('should return null for text without title line', () => {
      const text = 'No results found. Movie not found.';
      expect(parseOmdbMcpDetails(text)).toBeNull();
    });

    test('should parse title with special characters', () => {
      const text = '🎬 Spider-Man: No Way Home (2021)\n\nIMDB ID: tt10872600';
      const result = parseOmdbMcpDetails(text);
      expect(result).not.toBeNull();
      expect(result.Title).toBe('Spider-Man: No Way Home');
      expect(result.Year).toBe('2021');
    });
  });

  describe('getVideoDetailsMcp', () => {
    test('should return false when no title on job', async () => {
      const job = { config: {} };
      const result = await getVideoDetailsMcp(job);
      expect(result).toBe(false);
    });

    test('should return false when no MCP apps are connected', async () => {
      const job = { title: 'Test Movie', config: {} };
      const result = await getVideoDetailsMcp(job);
      expect(result).toBe(false);
    });
  });
});
