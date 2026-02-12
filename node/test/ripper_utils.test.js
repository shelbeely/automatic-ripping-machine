const path = require('path');
const fs = require('fs');
const { cleanForFilename, convertJobType, fixJobTitle, findLargestFile, escapeXml, generateMkvTagsXml, writeMkvTags } = require('../src/ripper/utils');

describe('Ripper Utils', () => {
  describe('cleanForFilename', () => {
    test('should remove invalid characters', () => {
      expect(cleanForFilename('Movie: The Sequel?')).toBe('Movie The Sequel');
    });

    test('should handle empty string', () => {
      expect(cleanForFilename('')).toBe('');
    });

    test('should handle null/undefined', () => {
      expect(cleanForFilename(null)).toBe('');
      expect(cleanForFilename(undefined)).toBe('');
    });

    test('should collapse multiple spaces', () => {
      expect(cleanForFilename('Movie   Title')).toBe('Movie Title');
    });

    test('should remove special chars', () => {
      expect(cleanForFilename('A<B>C:D"E/F\\G|H?I*J')).toBe('ABCDEFGHIJ');
    });
  });

  describe('convertJobType', () => {
    test('should convert movie type', () => {
      expect(convertJobType('movie')).toBe('movies');
    });

    test('should convert series type', () => {
      expect(convertJobType('series')).toBe('tv');
    });

    test('should convert tv show type', () => {
      expect(convertJobType('tv show')).toBe('tv');
    });

    test('should handle empty string', () => {
      expect(convertJobType('')).toBe('');
    });

    test('should pass through unknown types', () => {
      expect(convertJobType('documentary')).toBe('documentary');
    });
  });

  describe('fixJobTitle', () => {
    test('should add year to title', () => {
      const job = { title: 'Test Movie', year: '2024' };
      expect(fixJobTitle(job)).toBe('Test Movie (2024)');
    });

    test('should handle missing year', () => {
      const job = { title: 'Test Movie', year: '' };
      expect(fixJobTitle(job)).toBe('Test Movie');
    });

    test('should handle missing title', () => {
      const job = { title: '', year: '2024' };
      expect(fixJobTitle(job)).toBe('unknown (2024)');
    });
  });

  describe('findLargestFile', () => {
    let tmpDir;

    beforeAll(() => {
      tmpDir = path.join(__dirname, 'tmp_largest');
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'small.txt'), 'a');
      fs.writeFileSync(path.join(tmpDir, 'large.txt'), 'a'.repeat(1000));
      fs.writeFileSync(path.join(tmpDir, 'medium.txt'), 'a'.repeat(100));
    });

    afterAll(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('should find the largest file', () => {
      const files = ['small.txt', 'large.txt', 'medium.txt'];
      expect(findLargestFile(files, tmpDir)).toBe('large.txt');
    });

    test('should return null for empty list', () => {
      expect(findLargestFile([], tmpDir)).toBeNull();
    });

    test('should handle nonexistent files gracefully', () => {
      const files = ['nonexistent.txt'];
      expect(findLargestFile(files, tmpDir)).toBeNull();
    });
  });

  describe('escapeXml', () => {
    test('should escape ampersands', () => {
      expect(escapeXml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    test('should escape angle brackets', () => {
      expect(escapeXml('<script>')).toBe('&lt;script&gt;');
    });

    test('should escape quotes', () => {
      expect(escapeXml('"hello"')).toBe('&quot;hello&quot;');
    });

    test('should handle empty/null input', () => {
      expect(escapeXml('')).toBe('');
      expect(escapeXml(null)).toBe('');
      expect(escapeXml(undefined)).toBe('');
    });

    test('should handle strings with no special chars', () => {
      expect(escapeXml('Hello World')).toBe('Hello World');
    });
  });

  describe('generateMkvTagsXml', () => {
    test('should return null for null credits', () => {
      expect(generateMkvTagsXml(null)).toBeNull();
    });

    test('should generate valid XML with basic fields', () => {
      const credits = {
        title: 'The Dark Knight',
        year: '2008',
        synopsis: 'Batman fights the Joker.',
        language: 'English',
        country: 'United States',
        rating: 'PG-13',
        studio: 'Warner Bros.',
      };
      const xml = generateMkvTagsXml(credits);
      expect(xml).toContain('<?xml version="1.0"');
      expect(xml).toContain('<Tags>');
      expect(xml).toContain('<Name>TITLE</Name>');
      expect(xml).toContain('<String>The Dark Knight</String>');
      expect(xml).toContain('<Name>SYNOPSIS</Name>');
      expect(xml).toContain('<Name>LAW_RATING</Name>');
      expect(xml).toContain('<String>PG-13</String>');
      expect(xml).toContain('<Name>PRODUCTION_STUDIO</Name>');
      expect(xml).toContain('</Tags>');
    });

    test('should include director, writer, and cast', () => {
      const credits = {
        title: 'Test Movie',
        director: ['Christopher Nolan'],
        writer: ['Jonathan Nolan', 'Christopher Nolan'],
        cast: [
          { actor: 'Christian Bale', character: 'Bruce Wayne' },
          { actor: 'Heath Ledger', character: 'The Joker' },
        ],
      };
      const xml = generateMkvTagsXml(credits);
      expect(xml).toContain('<Name>DIRECTOR</Name>');
      expect(xml).toContain('<String>Christopher Nolan</String>');
      expect(xml).toContain('<Name>WRITTEN_BY</Name>');
      expect(xml).toContain('<Name>ACTOR</Name>');
      expect(xml).toContain('Christian Bale as Bruce Wayne');
      expect(xml).toContain('Heath Ledger as The Joker');
    });

    test('should include multiple genres', () => {
      const credits = {
        title: 'Test',
        genre: ['Action', 'Drama', 'Thriller'],
      };
      const xml = generateMkvTagsXml(credits);
      const genreMatches = xml.match(/<Name>GENRE<\/Name>/g);
      expect(genreMatches).toHaveLength(3);
    });

    test('should include composer, cinematographer, and editor', () => {
      const credits = {
        title: 'Test',
        composer: ['Hans Zimmer'],
        cinematographer: ['Wally Pfister'],
        editor: ['Lee Smith'],
        production_designer: ['Nathan Crowley'],
        costume_designer: ['Lindy Hemming'],
      };
      const xml = generateMkvTagsXml(credits);
      expect(xml).toContain('<Name>COMPOSER</Name>');
      expect(xml).toContain('<Name>CINEMATOGRAPHER</Name>');
      expect(xml).toContain('<Name>EDITED_BY</Name>');
      expect(xml).toContain('<Name>PRODUCTION_DESIGNER</Name>');
      expect(xml).toContain('<Name>COSTUME_DESIGNER</Name>');
    });

    test('should escape XML special characters', () => {
      const credits = {
        title: 'Tom & Jerry: The Movie',
        synopsis: 'A "great" film with <special> effects.',
      };
      const xml = generateMkvTagsXml(credits);
      expect(xml).toContain('Tom &amp; Jerry: The Movie');
      expect(xml).toContain('A &quot;great&quot; film with &lt;special&gt; effects.');
    });

    test('should handle cast without character names', () => {
      const credits = {
        title: 'Test',
        cast: [{ actor: 'Actor Name' }],
      };
      const xml = generateMkvTagsXml(credits);
      expect(xml).toContain('<Name>ACTOR</Name>');
      expect(xml).toContain('<String>Actor Name</String>');
    });
  });

  describe('writeMkvTags', () => {
    test('should return null when file does not exist', async () => {
      const result = await writeMkvTags('/nonexistent/file.mkv', { config: {} });
      expect(result).toBeNull();
    });

    test('should return null when mkvPath is empty', async () => {
      const result = await writeMkvTags('', { config: {} });
      expect(result).toBeNull();
    });

    test('should return null when no AI agent configured and no credits', async () => {
      const tmpFile = path.join(__dirname, 'tmp_tag_test.mkv');
      fs.writeFileSync(tmpFile, 'fake mkv');
      try {
        const result = await writeMkvTags(tmpFile, { config: {} });
        expect(result).toBeNull();
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });
  });
});
