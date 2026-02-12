const { convertToSeconds, parseLine, parseContent } = require('../src/ripper/makemkv');

describe('MakeMKV Utils', () => {
  describe('convertToSeconds', () => {
    test('should convert HH:MM:SS', () => {
      expect(convertToSeconds('1:30:00')).toBe(5400);
    });

    test('should convert MM:SS', () => {
      expect(convertToSeconds('5:30')).toBe(330);
    });

    test('should convert seconds only', () => {
      expect(convertToSeconds('45')).toBe(45);
    });

    test('should handle empty string', () => {
      expect(convertToSeconds('')).toBe(0);
    });

    test('should handle null', () => {
      expect(convertToSeconds(null)).toBe(0);
    });

    test('should handle 2:15:30', () => {
      expect(convertToSeconds('2:15:30')).toBe(8130);
    });
  });

  describe('parseLine', () => {
    test('should parse MakeMKV output line', () => {
      const result = parseLine('TINFO:0,9,0,"1:30:00"');
      expect(result).not.toBeNull();
      expect(result.prefix).toBe('TINFO');
      expect(result.content).toBe('0,9,0,"1:30:00"');
    });

    test('should return null for invalid line', () => {
      expect(parseLine('')).toBeNull();
      expect(parseLine('no colon here')).toBeNull();
    });
  });

  describe('parseContent', () => {
    test('should parse CSV content', () => {
      const result = parseContent('0,9,0,"1:30:00"');
      expect(result).toHaveLength(4);
      expect(result[0]).toBe('0');
      expect(result[3]).toBe('1:30:00');
    });

    test('should handle empty content', () => {
      expect(parseContent('')).toEqual([]);
    });
  });
});
