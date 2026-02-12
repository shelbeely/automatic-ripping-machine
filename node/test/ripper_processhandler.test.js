const { armSubprocess } = require('../src/ripper/process_handler');

describe('Process Handler', () => {
  test('should execute simple command', () => {
    const result = armSubprocess('echo "hello world"', { shell: true });
    expect(result.trim()).toBe('hello world');
  });

  test('should return null on error when check is false', () => {
    const result = armSubprocess('nonexistent_command_xyz', { shell: true, check: false });
    expect(result).toBeNull();
  });

  test('should throw on error when check is true', () => {
    expect(() => {
      armSubprocess('nonexistent_command_xyz', { shell: true, check: true });
    }).toThrow();
  });

  test('should handle array command', () => {
    const result = armSubprocess(['echo', 'test'], { shell: true });
    expect(result.trim()).toBe('test');
  });
});
