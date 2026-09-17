const path = require('path');
const { box, section, msg, colors, icons, blank, changeBadge, worktreeBadges } = require('../ui/output');
const { withSpinner } = require('../ui/spinner');
const { getWorktrees, inspectWorktrees } = require('../services/worktree');
const { fetchOrigin, isBareRepoExists } = require('../services/git');
const { findRootDir, loadConfig, getBareDir, getActivePath } = require('../utils/config-file');

async function list() {
  const rootDir = findRootDir();
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
  const config = loadConfig(rootDir);

  const items = await withSpinner('상태 확인 중...', () =>
    inspectWorktrees(bareDir, rootDir, worktrees.filter(wt => !wt.isBare), config.DEFAULT_BASE_BRANCH)
  );

  for (const wt of worktrees.filter(w => w.isBare)) {
    console.log(`    ${colors.dim(wt.path)} ${colors.dim('(bare)')}`);
  }

  for (const wt of items) {
    const isActive = activePath && path.resolve(wt.path) === path.resolve(activePath);
    const activeMarker = isActive ? colors.success('●') : colors.dim('○');
    const branchLabel = wt.branch ? colors.info(`[${wt.branch}]`) : '';
    const badges = worktreeBadges(wt);

    console.log(`    ${activeMarker} ${colors.bold(wt.name.padEnd(20))} ${branchLabel} ${changeBadge(wt.changes)}${badges ? `  ${badges}` : ''}`);
  }

  const autoCount = items.filter(i => i.selected).length;
  if (autoCount > 0) {
    blank();
    console.log(`  ${colors.dim(`머지 완료 ${autoCount}개 — grove remove 에서 자동 선택됩니다`)}`);
  }

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

  if (config.DOCKER_MODE) {
    console.log(`    ${colors.dim('DOCKER_MODE:')} ${colors.dim(config.DOCKER_MODE)}`);
  }
  if (config.PRE_SWITCH_COMMANDS && config.PRE_SWITCH_COMMANDS.length > 0) {
    blank();
    console.log(`    ${colors.dim('PRE_SWITCH:')}  ${colors.dim(config.PRE_SWITCH_COMMANDS.join(', '))}`);
  }
  if (config.POST_CREATE_COMMANDS && config.POST_CREATE_COMMANDS.length > 0) {
    console.log(`    ${colors.dim('POST_CREATE:')} ${colors.dim(config.POST_CREATE_COMMANDS.join(', '))}`);
  }
}

module.exports = { list };
