const { box, section, msg, colors, icons, blank } = require('../ui/output');
const { withSpinner } = require('../ui/spinner');
const { getWorktrees } = require('../services/worktree');
const { fetchOrigin, isBareRepoExists } = require('../services/git');
const { loadConfig, getBareDir } = require('../utils/config-file');

/**
 * 목록 보기 명령어
 */
async function list() {
  const rootDir = process.cwd();
  const bareDir = getBareDir(rootDir);

  // bare repo 확인
  if (!isBareRepoExists(rootDir)) {
    msg.err("'.bare' 폴더가 없습니다");
    return;
  }

  box(`${icons.list} 워크트리 목록`);

  // 원격 저장소 동기화
  await withSpinner('원격 저장소 동기화 중...', () => fetchOrigin(bareDir));

  // 워크트리 목록 표시
  section('워크트리');
  const worktrees = await getWorktrees(bareDir);

  for (const wt of worktrees) {
    if (wt.isBare) {
      console.log(`    ${colors.dim(wt.path)} ${colors.dim('(bare)')}`);
    } else {
      console.log(`    ${wt.path} ${colors.info(`[${wt.branch}]`)}`);
    }
  }

  // Symlink 설정 표시
  const config = loadConfig(rootDir);

  if (config.SYMLINKS && config.SYMLINKS.length > 0) {
    section('Symlink 설정');

    for (const mapping of config.SYMLINKS) {
      const [src, dest] = mapping.split(':');
      console.log(`    ${src} ${icons.arrow} ${dest}`);
    }
  }

  // 설정 정보 표시
  section('현재 설정');
  console.log(`    ${colors.dim('Bare 디렉토리:')} ${config.BARE_DIR}`);
  console.log(`    ${colors.dim('기본 브랜치:')} ${config.DEFAULT_BASE_BRANCH}`);
  console.log(`    ${colors.dim('브랜치 prefix:')} ${config.DEFAULT_BRANCH_PREFIX}`);
}

module.exports = { list };
