const { execSync, spawn } = require('child_process');

function armSubprocess(cmd, options = {}) {
  const { shell = false, check = false } = options;
  try {
    const cmdStr = Array.isArray(cmd) ? cmd.join(' ') : cmd;
    const result = execSync(cmdStr, {
      shell: shell || typeof cmd === 'string',
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
    });
    return result;
  } catch (err) {
    if (check) throw err;
    console.error(`Subprocess error: ${err.message}`);
    return null;
  }
}

function armSpawn(cmd, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      ...options,
      stdio: options.stdio || 'pipe',
    });
    let stdout = '';
    let stderr = '';
    if (child.stdout) {
      child.stdout.on('data', (data) => { stdout += data.toString(); });
    }
    if (child.stderr) {
      child.stderr.on('data', (data) => { stderr += data.toString(); });
    }
    child.on('close', (code) => {
      if (code !== 0 && options.check) {
        reject(new Error(`Process exited with code ${code}: ${stderr}`));
      } else {
        resolve({ stdout, stderr, code });
      }
    });
    child.on('error', reject);
  });
}

module.exports = { armSubprocess, armSpawn };
