const { spawnSync } = require('child_process');
const path = require('path');
const { createLogger } = require('./ripper/logger');

const logger = createLogger('git-story', { logLevel: 'info' });

function formatDate(dateString) {
  if (!dateString) return null;
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().split('T')[0];
}

function getCompleteGitHistory(repoPath = path.resolve(__dirname, '..', '..')) {
  const normalizedPath = path.resolve(repoPath);
  const result = spawnSync(
    'git',
    ['-C', normalizedPath, 'log', '--reverse', '--pretty=format:%H%x09%an%x09%ad%x09%s', '--date=iso'],
    { encoding: 'utf8' },
  );

  if (result.error) {
    throw result.error;
  }

  const stderr = (result.stderr || '').trim();
  if (result.status !== 0) {
    if (stderr.includes('does not have any commits yet')) {
      logger.warn(`No commits found in repository at ${normalizedPath}`);
      return [];
    }
    throw new Error(stderr || 'Failed to read git history');
  }

  return result.stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\t');
      const [hash, author, date, ...subjectParts] = parts;
      return {
        hash,
        author,
        date,
        subject: subjectParts.join('\t'),
      };
    });
}

function formatStoryFromCommits(commits) {
  if (!commits || commits.length === 0) {
    return 'No commits found; this repository is still waiting for its first chapter.';
  }

  const first = commits[0];
  const last = commits[commits.length - 1];
  const middle = commits.slice(1, -1);

  const firstDate = formatDate(first.date);
  let story = `This repository's journey spans ${commits.length} commit${commits.length === 1 ? '' : 's'}. `;
  story += `It begins with "${first.subject}"${first.author ? ` by ${first.author}` : ''}${firstDate ? ` on ${firstDate}` : ''}. `;

  if (middle.length) {
    const middleSubjects = middle.map((c) => `"${c.subject}"`).join(', ');
    story += `It travels through ${middle.length} more ${middle.length === 1 ? 'commit' : 'commits'}: ${middleSubjects}. `;
  }

  if (commits.length > 1) {
    story += `The latest chapter is "${last.subject}"${last.author ? ` by ${last.author}` : ''}.`;
  } else {
    story += 'The story is just getting started.';
  }

  return story.trim();
}

function tellStoryFromGitHistory(repoPath = path.resolve(__dirname, '..', '..')) {
  const commits = getCompleteGitHistory(repoPath);
  return formatStoryFromCommits(commits);
}

if (require.main === module) {
  try {
    // eslint-disable-next-line no-console
    console.log(tellStoryFromGitHistory());
  } catch (err) {
    logger.error(`Failed to tell git story: ${err.message}`);
    process.exit(1);
  }
}

module.exports = {
  getCompleteGitHistory,
  formatStoryFromCommits,
  tellStoryFromGitHistory,
};
