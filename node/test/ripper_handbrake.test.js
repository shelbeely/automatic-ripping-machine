const { correctHbSettings, buildHandbrakeCommand } = require('../src/ripper/handbrake');

describe('HandBrake Utils', () => {
  describe('correctHbSettings', () => {
    test('should return DVD settings for DVD', () => {
      const job = {
        disctype: 'dvd',
        config: {
          HB_PRESET_DVD: 'Fast 1080p30',
          HB_PRESET_BD: 'HQ 1080p30',
          HB_ARGS_DVD: '--all-audio',
          HB_ARGS_BD: '',
          DEST_EXT: 'mkv',
        },
      };
      const settings = correctHbSettings(job);
      expect(settings.preset).toBe('Fast 1080p30');
      expect(settings.args).toBe('--all-audio');
    });

    test('should return Blu-ray settings for bluray', () => {
      const job = {
        disctype: 'bluray',
        config: {
          HB_PRESET_DVD: 'Fast 1080p30',
          HB_PRESET_BD: 'HQ 1080p30',
          HB_ARGS_BD: '--all-subtitles',
          DEST_EXT: 'mp4',
        },
      };
      const settings = correctHbSettings(job);
      expect(settings.preset).toBe('HQ 1080p30');
      expect(settings.ext).toBe('mp4');
    });

    test('should handle missing config', () => {
      const job = { disctype: 'dvd', config: {} };
      const settings = correctHbSettings(job);
      expect(settings.preset).toBe('');
      expect(settings.ext).toBe('mkv');
    });
  });

  describe('buildHandbrakeCommand', () => {
    test('should build basic command', () => {
      const cmd = buildHandbrakeCommand('/input', '/output.mkv', 'Fast 1080p30', '', '');
      expect(cmd).toContain('HandBrakeCLI');
      expect(cmd).toContain('-i "/input"');
      expect(cmd).toContain('-o "/output.mkv"');
      expect(cmd).toContain('--preset "Fast 1080p30"');
    });

    test('should include track number', () => {
      const cmd = buildHandbrakeCommand('/input', '/output.mkv', '', '', '', { trackNumber: 5 });
      expect(cmd).toContain('-t 5');
    });

    test('should include main feature flag', () => {
      const cmd = buildHandbrakeCommand('/input', '/output.mkv', '', '', '', { mainFeature: true });
      expect(cmd).toContain('--main-feature');
    });
  });
});
