const path = require('path');
const execa = require('execa');
const { box, section, msg, colors, icons, blank } = require('../ui/output');
const { withSpinner } = require('../ui/spinner');
const { getWorktrees } = require('../services/worktree');
const { fetchOrigin, isBareRepoExists } = require('../services/git');
const { loadConfig, getBareDir, getActivePath } = require('../utils/config-file');

async function getWorktreeStatus(worktreePath) {
  try {
    const { stdout } = await execa('git', ['-C', worktreePath, 'status', '--short'], { reject: false });
    const count = stdout.trim().split('\n').filter(Boolean).length;
    return count === 0 ? colors.success('[clean]') : colors.warn(`[${count} changes]`);
  } catch {
    return '';
  }
}

async function list() {
  const rootDir = process.cwd();
  const bareDir = getBareDir(rootDir);

  if (!isBareRepoExists(rootDir)) {
    msg.err("'.bare' 폴더가 없습니다");
    return;
  }

  box(`${icons.list} 워크트리 목록`);

  await withSpinner('원격 저장소 동기화 중...', () => fetchOrigin(bareDir));

  section('워크트리');
  const worktrees = await getWorktrees(bareDir);
  const activePath = getActivePath(rootDir);

  for (const wt of worktrees) {
    if (wt.isBare) {
      console.log(`    ${colors.dim(wt.path)} ${colors.dim('(bare)')}`);
      continue;
    }

    const isActive = activePath && path.resolve(wt.path) === path.resolve(activePath);
    const activeMarker = isActive ? colors.success('●') : colors.dim('○');
    const statusBadge = await getWorktreeStatus(wt.path);
    const branchLabel = wt.branch ? colors.info(`[${wt.branch}]`) : '';
    const name = path.basename(wt.path);

    console.log(`    ${activeMarker} ${colors.bold(name.padEnd(20))} ${branchLabel} ${statusBadge}`);
  }

  const config = loadConfig(rootDir);

  if (config.FILES && config.FILES.length > 0) {
    section('파일 복사 설정');
    for (const mapping of config.FILES) {
      const [src, dest] = mapping.split(':');
      console.log(`    ${src} ${icons.arrow} ${dest}`);
    }
  }

  section('현재 설정');
  console.log(`    ${colors.dim('Bare 디렉토리:')} ${config.BARE_DIR}`);
  console.log(`    ${colors.dim('기본 브랜치:')}   ${config.DEFAULT_BASE_BRANCH}`);
  console.log(`    ${colors.dim('브랜치 prefix:')} ${config.DEFAULT_BRANCH_PREFIX}`);

  if (config.PRE_SWITCH_COMMANDS && config.PRE_SWITCH_COMMANDS.length > 0) {
    blank();
    console.log(`    ${colors.dim('PRE_SWITCH:')}  ${colors.dim(config.PRE_SWITCH_COMMANDS.join(', '))}`);
  }
  if (config.POST_CREATE_COMMANDS && config.POST_CREATE_COMMANDS.length > 0) {
    console.log(`    ${colors.dim('POST_CREATE:')} ${colors.dim(config.POST_CREATE_COMMANDS.join(', '))}`);
  }
}

module.exports = { list };
