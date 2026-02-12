const path = require('path');
const fs = require('fs');
const { cleanForFilename, convertJobType, fixJobTitle, findLargestFile } = require('../src/ripper/utils');

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
});
