const path = require('path');
const { box, section, msg, colors, icons, blank } = require('../ui/output');
const { inputText, confirm, selectBranch } = require('../ui/prompts');
const { withSpinner } = require('../ui/spinner');
const { getWorktrees } = require('../services/worktree');
const { getBranches } = require('../services/branch');
const { createWorktreeWithNewBranch, createWorktreeWithExistingBranch } = require('../services/worktree');
const { linkFilesToWorktree } = require('../services/symlink');
const { fetchOrigin, isBareRepoExists } = require('../services/git');
const { loadConfig, getBareDir } = require('../utils/config-file');
const { validateFolderName } = require('../utils/validators');
const { folderExists } = require('../utils/validators');

/**
 * 워크트리 생성 명령어
 */
async function create() {
  const rootDir = process.cwd();
  const bareDir = getBareDir(rootDir);

  // bare repo 확인
  if (!isBareRepoExists(rootDir)) {
    msg.err("'.bare' 폴더가 없습니다");
    msg.info('bare clone을 먼저 생성하세요:');
    console.log(`    ${colors.dim('git clone --bare <repo-url> .bare')}`);
    return;
  }

  box(`${icons.folder} 워크트리 생성`);

  // 원격 저장소 동기화
  await withSpinner('원격 저장소 동기화 중...', () => fetchOrigin(bareDir));

  // 현재 워크트리 목록 표시
  section('현재 워크트리');
  const worktrees = await getWorktrees(bareDir);
  for (const wt of worktrees) {
    console.log(`    ${colors.dim(wt.path)} ${wt.branch ? colors.info(`[${wt.branch}]`) : ''}`);
  }

  // 폴더명 입력
  blank();
  const folder = await inputText('폴더명 입력', {
    validate: (value) => {
      const validation = validateFolderName(value);
      if (validation !== true) return validation;

      const folderPath = path.join(rootDir, value);
      if (folderExists(folderPath)) {
        return `'${value}' 폴더가 이미 존재합니다.`;
      }
      return true;
    }
  });

  if (!folder) {
    msg.warn('취소됨');
    return;
  }

  // 브랜치 선택
  section('브랜치 선택');
  const branches = await getBranches(bareDir);
  const config = loadConfig(rootDir);

  const branchSelection = await selectBranch(branches, config.DEFAULT_BASE_BRANCH);

  if (!branchSelection) {
    msg.warn('취소됨');
    return;
  }

  let finalBranch = '';

  if (branchSelection.type === 'new') {
    // 새 브랜치 생성 플로우
    box(`${icons.branch} 새 브랜치 생성`);

    // 기반 브랜치 선택
    section('[1/2] 분기 브랜치 선택');
    for (let i = 0; i < branches.length; i++) {
      const marker = branches[i] === config.DEFAULT_BASE_BRANCH ? ` ${colors.success('← 기본')}` : '';
      console.log(`    ${colors.dim(`${i + 1}.`)} ${branches[i]}${marker}`);
    }

    blank();
    const baseInput = await inputText(`기반 브랜치 (Enter: ${config.DEFAULT_BASE_BRANCH})`);
    const baseBranch = baseInput || config.DEFAULT_BASE_BRANCH;

    // 새 브랜치 이름
    section('[2/2] 새 브랜치 이름');
    const suggestedBranch = `${config.DEFAULT_BRANCH_PREFIX}${folder}`;
    msg.info(`제안: ${colors.info(suggestedBranch)}`);
    msg.info('예시: feat/login, fix/bug-123, issue/576');

    blank();
    const newBranch = await inputText(`브랜치 이름 (Enter: ${suggestedBranch})`);
    finalBranch = newBranch || suggestedBranch;

    // 확인
    box('생성 정보 확인');
    console.log(`    ${icons.folder} 폴더:   ${colors.bold(folder)}`);
    console.log(`    ${icons.branch} 브랜치: ${colors.bold(finalBranch)}`);
    console.log(`    ${icons.arrow} 분기:   ${colors.dim(baseBranch)} ${icons.arrow} ${colors.info(finalBranch)}`);

    blank();
    const proceed = await confirm('진행할까요?', true);
    if (!proceed) {
      msg.warn('취소됨');
      return;
    }

    // 워크트리 생성
    blank();
    const result = await withSpinner('워크트리 생성 중...', () =>
      createWorktreeWithNewBranch(bareDir, folder, finalBranch, baseBranch)
    );

    if (!result.success) {
      msg.err('워크트리 생성 실패');
      msg.info('브랜치명에 특수문자가 있으면 문제가 될 수 있습니다');
      return;
    }
  } else {
    // 기존 브랜치 사용
    finalBranch = branchSelection.branch;

    // 확인
    box('생성 정보 확인');
    console.log(`    ${icons.folder} 폴더:   ${colors.bold(folder)}`);
    console.log(`    ${icons.branch} 브랜치: ${colors.bold(finalBranch)}`);

    blank();
    const proceed = await confirm('진행할까요?', true);
    if (!proceed) {
      msg.warn('취소됨');
      return;
    }

    // 워크트리 생성
    blank();
    const result = await withSpinner('워크트리 생성 중...', () =>
      createWorktreeWithExistingBranch(bareDir, folder, finalBranch)
    );

    if (!result.success) {
      msg.err('워크트리 생성 실패');
      return;
    }
  }

  msg.ok(`워크트리 생성 완료: ${colors.bold(folder)} (${colors.info(finalBranch)})`);

  // symlink 연결 제안
  if (config.SYMLINKS && config.SYMLINKS.length > 0) {
    blank();
    const linkFiles = await confirm('설정된 파일들도 연결할까요?', true);

    if (linkFiles) {
      const results = await linkFilesToWorktree(rootDir, folder, config.SYMLINKS);
      blank();
      for (const r of results) {
        if (r.success) {
          const [src, dest] = r.mapping.split(':');
          console.log(`    ${colors.success(icons.check)} ${src} ${icons.arrow} ${folder}/${dest}`);
        } else {
          const [src] = r.mapping.split(':');
          console.log(`    ${colors.error(icons.cross)} ${src} ${colors.dim(`(${r.error})`)}`);
        }
      }
      msg.ok('연결 완료');
    }
  }
}

module.exports = { create };
