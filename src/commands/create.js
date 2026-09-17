const path = require('path');
const fs = require('fs');
const execa = require('execa');
const { box, section, msg, colors, icons, blank } = require('../ui/output');
const { inputText, confirm, selectBranch } = require('../ui/prompts');
const { withSpinner } = require('../ui/spinner');
const { getWorktrees } = require('../services/worktree');
const { getBranches } = require('../services/branch');
const { createWorktreeWithNewBranch, createWorktreeWithExistingBranch } = require('../services/worktree');
const { copyFilesToWorktree } = require('../services/symlink');
const { fetchOrigin, isBareRepoExists } = require('../services/git');
const { findRootDir, loadConfig, getBareDir, getActivePath, setActivePath } = require('../utils/config-file');
const { validateFolderName } = require('../utils/validators');
const { switchDocker } = require('../services/docker');
const { folderExists } = require('../utils/validators');

/**
 * 워크트리 생성 명령어
 */
async function create() {
  const rootDir = findRootDir();
  const bareDir = getBareDir(rootDir);
  const config = loadConfig(rootDir);

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

  // PRE_SWITCH_COMMANDS 실행
  if (config.PRE_SWITCH_COMMANDS && config.PRE_SWITCH_COMMANDS.length > 0) {
    const activePath = getActivePath(rootDir);
    if (activePath && fs.existsSync(activePath)) {
      blank();
      section('이전 환경 정리');
      for (const cmd of config.PRE_SWITCH_COMMANDS) {
        try {
          msg.info(`실행 중: ${colors.dim(cmd)}`);
          const parts = cmd.split(' ');
          const bin = parts[0];
          const args = parts.slice(1);
          await execa(bin, args, { cwd: activePath, stdio: 'inherit' });
          msg.ok('완료');
        } catch (err) {
          msg.warn(`명령 실패: ${cmd}`);
          console.log(`    ${colors.dim(err.message || '')}`);
          blank();
          const proceed = await confirm('실패했지만 계속 진행할까요?', false);
          if (!proceed) {
            msg.warn('취소됨');
            return;
          }
        }
      }
    }
  }

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

  // FILES 복사 제안
  if (config.FILES && config.FILES.length > 0) {
    blank();
    const copyFiles = await confirm('설정된 파일들도 복사할까요?', true);

    if (copyFiles) {
      const results = await copyFilesToWorktree(rootDir, folder, config.FILES);
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
      msg.ok('복사 완료');
    }
  }

  // POST_CREATE_COMMANDS 실행
  if (config.POST_CREATE_COMMANDS && config.POST_CREATE_COMMANDS.length > 0) {
    blank();
    section('새 환경 시작');
    const newWorktreePath = path.join(rootDir, folder);
    for (const cmd of config.POST_CREATE_COMMANDS) {
      try {
        msg.info(`실행 중: ${colors.dim(cmd)}`);
        const parts = cmd.split(' ');
        const bin = parts[0];
        const args = parts.slice(1);
        await execa(bin, args, {
          cwd: newWorktreePath,
          stdio: 'inherit',
          env: { ...process.env, COMPOSE_PROJECT_NAME: folder }
        });
        msg.ok('완료');
      } catch (err) {
        msg.err(`명령 실패: ${cmd}`);
        console.log(`    ${colors.dim(err.message || '')}`);
      }
    }
  }

  // active worktree 업데이트
  setActivePath(rootDir, path.join(rootDir, folder));

  // 단일 컨테이너 모드: 루트에서 compose up
  if (config.DOCKER_MODE === 'single') {
    blank();
    section('Docker 전환');
    const docker = await switchDocker(rootDir, folder);
    if (docker.ok) msg.ok(`컨테이너가 ${colors.bold(folder)} 워크트리를 바라봅니다`);
    else msg.err(`docker compose up 실패: ${docker.error}`);
  }
}

module.exports = { create };
