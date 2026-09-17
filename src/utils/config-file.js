const fs = require('fs');
const path = require('path');
const { DEFAULTS } = require('./constants');

/**
 * .worktree.config 파일 경로 반환
 * @param {string} rootDir - 루트 디렉토리
 * @returns {string}
 */
function getConfigPath(rootDir = process.cwd()) {
  return path.join(rootDir, DEFAULTS.CONFIG_FILE);
}

/**
 * 설정 파일 존재 여부 확인
 * @param {string} rootDir - 루트 디렉토리
 * @returns {boolean}
 */
function configExists(rootDir = process.cwd()) {
  return fs.existsSync(getConfigPath(rootDir));
}

/**
 * 설정 파일 로드
 * @param {string} rootDir - 루트 디렉토리
 * @returns {Object} - 설정 객체
 */
function loadConfig(rootDir = process.cwd()) {
  const configPath = getConfigPath(rootDir);

  const config = {
    BARE_DIR: DEFAULTS.BARE_DIR,
    DEFAULT_BASE_BRANCH: DEFAULTS.BASE_BRANCH,
    DEFAULT_BRANCH_PREFIX: DEFAULTS.BRANCH_PREFIX,
    FILES: [],
    PRE_SWITCH_COMMANDS: [],
    POST_CREATE_COMMANDS: [],
    DOCKER_MODE: ''
  };

  if (!fs.existsSync(configPath)) {
    return config;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');

    // BARE_DIR 파싱
    const bareDirMatch = content.match(/BARE_DIR="([^"]+)"/);
    if (bareDirMatch) config.BARE_DIR = bareDirMatch[1];

    // DEFAULT_BASE_BRANCH 파싱
    const baseBranchMatch = content.match(/DEFAULT_BASE_BRANCH="([^"]+)"/);
    if (baseBranchMatch) config.DEFAULT_BASE_BRANCH = baseBranchMatch[1];

    // DEFAULT_BRANCH_PREFIX 파싱
    const prefixMatch = content.match(/DEFAULT_BRANCH_PREFIX="([^"]+)"/);
    if (prefixMatch) config.DEFAULT_BRANCH_PREFIX = prefixMatch[1];

    // DOCKER_MODE 파싱 (single | perWorktree | '')
    const dockerMatch = content.match(/DOCKER_MODE="([^"]*)"/);
    if (dockerMatch) config.DOCKER_MODE = dockerMatch[1];

    // FILES 파싱
    const filesMatch = content.match(/FILES=\(\s*([\s\S]*?)\s*\)/);
    if (filesMatch) {
      const filesContent = filesMatch[1];
      const fileMatches = filesContent.matchAll(/"([^"]+)"/g);
      config.FILES = Array.from(fileMatches, m => m[1]);
    }

    // SYMLINKS deprecated → FILES로 병합
    const symlinksMatch = content.match(/SYMLINKS=\(\s*([\s\S]*?)\s*\)/);
    if (symlinksMatch && config.FILES.length === 0) {
      const symlinksContent = symlinksMatch[1];
      const linkMatches = symlinksContent.matchAll(/"([^"]+)"/g);
      config.FILES = Array.from(linkMatches, m => m[1]);
    }

    // PRE_SWITCH_COMMANDS 파싱
    const preMatch = content.match(/PRE_SWITCH_COMMANDS=\(\s*([\s\S]*?)\s*\)/);
    if (preMatch) {
      const preContent = preMatch[1];
      const preMatches = preContent.matchAll(/"([^"]+)"/g);
      config.PRE_SWITCH_COMMANDS = Array.from(preMatches, m => m[1]);
    }

    // POST_CREATE_COMMANDS 파싱
    const postMatch = content.match(/POST_CREATE_COMMANDS=\(\s*([\s\S]*?)\s*\)/);
    if (postMatch) {
      const postContent = postMatch[1];
      const postMatches = postContent.matchAll(/"([^"]+)"/g);
      config.POST_CREATE_COMMANDS = Array.from(postMatches, m => m[1]);
    }

    return config;
  } catch (error) {
    return config;
  }
}

/**
 * 설정 파일 저장
 * @param {Object} config - 설정 객체
 * @param {string} rootDir - 루트 디렉토리
 * @returns {boolean} - 성공 여부
 */
function saveConfig(config, rootDir = process.cwd()) {
  const configPath = getConfigPath(rootDir);

  const filesStr = (config.FILES || [])
    .map(s => `  "${s}"`)
    .join('\n');

  const preStr = (config.PRE_SWITCH_COMMANDS || [])
    .map(s => `  "${s}"`)
    .join('\n');

  const postStr = (config.POST_CREATE_COMMANDS || [])
    .map(s => `  "${s}"`)
    .join('\n');

  const content = `# Worktree Manager 설정 파일

BARE_DIR="${config.BARE_DIR || DEFAULTS.BARE_DIR}"
DEFAULT_BASE_BRANCH="${config.DEFAULT_BASE_BRANCH || DEFAULTS.BASE_BRANCH}"
DEFAULT_BRANCH_PREFIX="${config.DEFAULT_BRANCH_PREFIX || DEFAULTS.BRANCH_PREFIX}"
DOCKER_MODE="${config.DOCKER_MODE || ''}"

FILES=(
${filesStr}
)

PRE_SWITCH_COMMANDS=(
${preStr}
)

POST_CREATE_COMMANDS=(
${postStr}
)
`;

  try {
    fs.writeFileSync(configPath, content);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * 프로젝트 루트 탐색 (워크트리 안에서 실행해도 동작하도록 상위로 거슬러 올라감)
 * @param {string} startDir - 탐색 시작 디렉토리
 * @returns {string} - 루트 경로 (못 찾으면 startDir 그대로)
 */
function findRootDir(startDir = process.cwd()) {
  let dir = path.resolve(startDir);

  for (;;) {
    if (fs.existsSync(path.join(dir, DEFAULTS.BARE_DIR)) ||
        fs.existsSync(path.join(dir, DEFAULTS.CONFIG_FILE))) {
      return dir;
    }

    const parent = path.dirname(dir);
    if (parent === dir) return startDir;
    dir = parent;
  }
}

/**
 * Bare 디렉토리 경로 반환
 * @param {string} rootDir - 루트 디렉토리
 * @returns {string}
 */
function getBareDir(rootDir = process.cwd()) {
  const config = loadConfig(rootDir);
  return path.join(rootDir, config.BARE_DIR);
}

/**
 * 현재 active worktree 경로 반환
 * @param {string} rootDir - 루트 디렉토리
 * @returns {string|null}
 */
function getActivePath(rootDir = process.cwd()) {
  const statePath = require('path').join(rootDir, DEFAULTS.BARE_DIR, 'grove-state');
  if (!fs.existsSync(statePath)) return null;
  try {
    const content = fs.readFileSync(statePath, 'utf-8');
    const match = content.match(/active_worktree=(.+)/);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

/**
 * active worktree 경로 저장
 * @param {string} rootDir - 루트 디렉토리
 * @param {string} activePath - active worktree 절대 경로
 */
function setActivePath(rootDir = process.cwd(), activePath) {
  const statePath = require('path').join(rootDir, DEFAULTS.BARE_DIR, 'grove-state');
  fs.writeFileSync(statePath, `active_worktree=${activePath}\n`);
}

module.exports = {
  getConfigPath,
  configExists,
  loadConfig,
  saveConfig,
  findRootDir,
  getBareDir,
  getActivePath,
  setActivePath
};
