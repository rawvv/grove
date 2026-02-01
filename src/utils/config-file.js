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
    SYMLINKS: []
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

    // SYMLINKS 파싱
    const symlinksMatch = content.match(/SYMLINKS=\(\s*([\s\S]*?)\s*\)/);
    if (symlinksMatch) {
      const symlinksContent = symlinksMatch[1];
      const linkMatches = symlinksContent.matchAll(/"([^"]+)"/g);
      config.SYMLINKS = Array.from(linkMatches, m => m[1]);
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

  const symlinksStr = config.SYMLINKS
    .map(s => `  "${s}"`)
    .join('\n');

  const content = `# Worktree Manager 설정 파일

BARE_DIR="${config.BARE_DIR || DEFAULTS.BARE_DIR}"
DEFAULT_BASE_BRANCH="${config.DEFAULT_BASE_BRANCH || DEFAULTS.BASE_BRANCH}"
DEFAULT_BRANCH_PREFIX="${config.DEFAULT_BRANCH_PREFIX || DEFAULTS.BRANCH_PREFIX}"

SYMLINKS=(
${symlinksStr}
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
 * Bare 디렉토리 경로 반환
 * @param {string} rootDir - 루트 디렉토리
 * @returns {string}
 */
function getBareDir(rootDir = process.cwd()) {
  const config = loadConfig(rootDir);
  return path.join(rootDir, config.BARE_DIR);
}

module.exports = {
  getConfigPath,
  configExists,
  loadConfig,
  saveConfig,
  getBareDir
};
