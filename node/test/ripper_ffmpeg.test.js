const { parseFps, computeAspect, correctFfmpegSettings } = require('../src/ripper/ffmpeg');

describe('FFmpeg Utils', () => {
  describe('parseFps', () => {
    test('should parse fraction fps', () => {
      expect(parseFps('24000/1001')).toBeCloseTo(23.976, 2);
    });

    test('should parse integer fps', () => {
      expect(parseFps('30')).toBe(30);
    });

    test('should parse float fps', () => {
      expect(parseFps('29.97')).toBeCloseTo(29.97, 2);
    });

    test('should handle null', () => {
      expect(parseFps(null)).toBe(0);
    });

    test('should handle number input', () => {
      expect(parseFps(25)).toBe(25);
    });
  });

  describe('computeAspect', () => {
    test('should compute 16:9', () => {
      expect(computeAspect(1920, 1080)).toBe('16:9');
    });

    test('should compute 4:3', () => {
      expect(computeAspect(640, 480)).toBe('4:3');
    });

    test('should handle null values', () => {
      expect(computeAspect(null, 1080)).toBe('');
      expect(computeAspect(1920, null)).toBe('');
    });
  });

  describe('correctFfmpegSettings', () => {
    test('should return DVD settings', () => {
      const job = {
        disctype: 'dvd',
        config: {
          FFMPEG_PRE_ARGS_DVD: '-hwaccel auto',
          FFMPEG_ARGS_DVD: '-c:v libx264',
          DEST_EXT: 'mkv',
        },
      };
      const settings = correctFfmpegSettings(job);
      expect(settings.preArgs).toBe('-hwaccel auto');
      expect(settings.postArgs).toBe('-c:v libx264');
    });

    test('should return Blu-ray settings', () => {
      const job = {
        disctype: 'bluray',
        config: {
          FFMPEG_PRE_ARGS_BD: '-hwaccel cuda',
          FFMPEG_ARGS_BD: '-c:v hevc',
          DEST_EXT: 'mp4',
        },
      };
      const settings = correctFfmpegSettings(job);
      expect(settings.preArgs).toBe('-hwaccel cuda');
      expect(settings.postArgs).toBe('-c:v hevc');
      expect(settings.ext).toBe('mp4');
    });
  });
});
