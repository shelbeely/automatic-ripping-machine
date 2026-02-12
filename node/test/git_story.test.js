const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  getCompleteGitHistory,
  formatStoryFromCommits,
  tellStoryFromGitHistory,
} = require('../src/git_story');

function runGit(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || 'git command failed');
  }
}

function makeTempRepo() {
  const repoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'git-story-'));
  runGit(['init'], repoPath);
  runGit(['config', 'user.email', 'test@example.com'], repoPath);
  runGit(['config', 'user.name', 'Test User'], repoPath);
  return repoPath;
}

describe('formatStoryFromCommits', () => {
  it('builds a narrative that includes every commit', () => {
    const commits = [
      { hash: 'a1', author: 'Alice', date: '2024-01-01T00:00:00Z', subject: 'Initial spark' },
      { hash: 'b2', author: 'Bob', date: '2024-02-02T00:00:00Z', subject: 'Add feature' },
      { hash: 'c3', author: 'Cara', date: '2024-03-03T00:00:00Z', subject: 'Polish release' },
    ];

    const story = formatStoryFromCommits(commits);

    expect(story).toContain('3 commits');
    expect(story).toContain('Initial spark');
    expect(story).toContain('Add feature');
    expect(story).toContain('Polish release');
    expect(story.indexOf('Initial spark')).toBeLessThan(story.indexOf('Polish release'));
  });

  it('handles empty histories gracefully', () => {
    const story = formatStoryFromCommits([]);
    expect(story.toLowerCase()).toContain('no commits');
  });
});

describe('tellStoryFromGitHistory', () => {
  it('reads the complete git history in order', () => {
    const repoPath = makeTempRepo();
    try {
      fs.writeFileSync(path.join(repoPath, 'one.txt'), 'first');
      runGit(['add', '.'], repoPath);
      runGit(['commit', '-m', 'Initial spark'], repoPath);

      fs.writeFileSync(path.join(repoPath, 'two.txt'), 'second');
      runGit(['add', '.'], repoPath);
      runGit(['commit', '-m', 'Second act'], repoPath);

      fs.writeFileSync(path.join(repoPath, 'three.txt'), 'third');
      runGit(['add', '.'], repoPath);
      runGit(['commit', '-m', 'Final polish'], repoPath);

      const commits = getCompleteGitHistory(repoPath);
      expect(commits.map((c) => c.subject)).toEqual(['Initial spark', 'Second act', 'Final polish']);

      const story = tellStoryFromGitHistory(repoPath);
      expect(story).toContain('Initial spark');
      expect(story).toContain('Second act');
      expect(story).toContain('Final polish');
      expect(story.indexOf('Initial spark')).toBeLessThan(story.indexOf('Final polish'));
    } finally {
      fs.rmSync(repoPath, { recursive: true, force: true });
    }
  });
});
