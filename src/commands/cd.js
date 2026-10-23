const prompts = require('prompts');
const { colors } = require('../ui/output');
const { getWorktreesExcludeBare } = require('../services/worktree');
const { isBareRepoExists } = require('../services/git');
const { findRootDir, getBareDir, setActivePath, loadConfig } = require('../utils/config-file');
const { switchDocker } = require('../services/docker');
const { copyFilesToWorktree } = require('../services/symlink');

// stdout은 경로 전용 — 로그와 프롬프트는 전부 stderr로 보낸다
const err = (text) => process.stderr.write(`  ${colors.error('✗')} ${text}\n`);
const ok = (text) => process.stderr.write(`  ${colors.success('✓')} ${text}\n`);

/**
 * 이름/브랜치로 워크트리 찾기 (정확 일치 → 부분 일치)
 */
function findWorktree(worktrees, query) {
  const q = query.toLowerCase();
  return worktrees.find(wt => wt.name.toLowerCase() === q)
    || worktrees.find(wt => wt.name.toLowerCase().includes(q))
    || worktrees.find(wt => (wt.branch || '').toLowerCase().includes(q));
}

// docker가 워크트리 .env를 읽으므로 전환 전에 복사
async function copyConfiguredFiles(rootDir, worktreeName) {
  const files = loadConfig(rootDir).FILES || [];
  const results = await copyFilesToWorktree(rootDir, worktreeName, files);
  const copiedNames = results.filter(r => r.success).map(r => r.mapping.split(':')[1]);
  if (copiedNames.length > 0) ok(`파일 연결 완료: ${copiedNames.join(', ')}`);
  for (const r of results) {
    if (!r.success) err(`파일 복사 실패: ${r.mapping} (${r.error})`);
  }
}

/**
 * 워크트리 경로를 stdout에 출력 (셸 함수와 함께 사용)
 * @param {string} [query] - 워크트리명 또는 브랜치명 (생략 시 인터랙티브 선택)
 */
async function cd(query) {
  const rootDir = findRootDir();

  if (!isBareRepoExists(rootDir)) {
    err("'.bare' 폴더가 없습니다");
    process.exitCode = 1;
    return;
  }

  const worktrees = await getWorktreesExcludeBare(getBareDir(rootDir));

  if (worktrees.length === 0) {
    err('워크트리가 없습니다');
    process.exitCode = 1;
    return;
  }

  let target;

  if (query) {
    target = findWorktree(worktrees, query);
    if (!target) {
      err(`'${query}'와 일치하는 워크트리가 없습니다`);
      process.exitCode = 1;
      return;
    }
  } else {
    const response = await prompts({
      type: 'select',
      name: 'value',
      message: '이동할 워크트리',
      choices: worktrees.map(wt => ({
        title: `${wt.name} ${colors.info(`(${wt.branch})`)}`,
        value: wt
      })),
      stdout: process.stderr
    });

    target = response.value;
    if (!target) {
      process.exitCode = 1;
      return;
    }
  }

  setActivePath(rootDir, target.path);
  await copyConfiguredFiles(rootDir, target.name);
  const docker = await switchDocker(rootDir, target.name, { quiet: true });
  if (docker.ok === false) err(`docker compose up 실패: ${docker.error}`);
  process.stdout.write(`${target.path}\n`);
}

/**
 * 셸 함수 출력 — eval "$(grove shell-init)"
 */
function shellInit() {
  process.stdout.write(`grove() {
  if [ "$1" = "cd" ]; then
    shift
    local __grove_path
    __grove_path="$(command grove cd "$@")" && [ -n "$__grove_path" ] && cd "$__grove_path"
  else
    command grove "$@"
  fi
}
`);
}

module.exports = { cd, shellInit };
