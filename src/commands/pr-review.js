const execa = require('execa');
const path = require('path');
const { box, section, msg, colors, icons, blank } = require('../ui/output');
const { inputText, confirm, select } = require('../ui/prompts');
const { withSpinner } = require('../ui/spinner');
const { fetchOrigin, isBareRepoExists } = require('../services/git');
const { fetchPRBranch } = require('../services/branch');
const { createWorktreeWithExistingBranch } = require('../services/worktree');
const { linkFilesToWorktree } = require('../services/symlink');
const { loadConfig, getBareDir } = require('../utils/config-file');
const { folderExists } = require('../utils/validators');
const { prReviewSubMenu } = require('../ui/menu');

/**
 * gh CLI 설치 확인
 * @returns {boolean}
 */
function isGhInstalled() {
  try {
    execa.sync('gh', ['--version']);
    return true;
  } catch {
    return false;
  }
}

/**
 * PR 목록 조회
 * @param {string} bareDir - bare 저장소 경로
 * @param {string} state - PR 상태 (open/closed)
 * @returns {Promise<Array<{number: number, title: string, branch: string, author: string}>>}
 */
async function getPRList(bareDir, state) {
  try {
    const { stdout } = await execa('gh', [
      'pr', 'list',
      '--state', state,
      '--limit', '20',
      '--json', 'number,title,headRefName,author'
    ], { cwd: bareDir });

    const prs = JSON.parse(stdout);
    return prs.map(pr => ({
      number: pr.number,
      title: pr.title,
      branch: pr.headRefName,
      author: pr.author.login
    }));
  } catch {
    return [];
  }
}

/**
 * PR 상세 정보 조회
 * @param {string} bareDir - bare 저장소 경로
 * @param {number} prNumber - PR 번호
 */
async function showPRDetails(bareDir, prNumber) {
  try {
    const { stdout } = await execa('gh', ['pr', 'view', String(prNumber)], { cwd: bareDir });
    console.log(stdout);
  } catch (error) {
    msg.err('PR 정보를 가져올 수 없습니다');
  }
}

/**
 * 상태별 PR 목록 표시 및 워크트리 생성
 * @param {string} state - PR 상태 (open/closed)
 * @param {string} stateLabel - 상태 라벨
 */
async function prListByState(state, stateLabel) {
  const rootDir = process.cwd();
  const bareDir = getBareDir(rootDir);
  const config = loadConfig(rootDir);

  section(`${stateLabel} PR 목록`);

  const prs = await getPRList(bareDir, state);

  if (prs.length === 0) {
    msg.warn(`${stateLabel} PR이 없습니다`);
    return;
  }

  // PR 목록 선택지 생성
  const choices = prs.map((pr, index) => ({
    title: `${colors.info(`#${pr.number}`)} ${pr.title} ${colors.dim(`(${pr.author})`)}`,
    value: pr
  }));

  const selectedPR = await select('PR 선택', choices);

  if (!selectedPR) {
    msg.warn('취소됨');
    return;
  }

  // PR 상세 정보 표시
  section(`PR #${selectedPR.number} 상세`);
  await showPRDetails(bareDir, selectedPR.number);

  blank();
  const createWorktree = await confirm('이 PR로 워크트리를 생성하시겠습니까?', true);

  if (!createWorktree) {
    msg.warn('취소됨');
    return;
  }

  // 워크트리 생성
  const folder = `pr-${selectedPR.number}`;
  const folderPath = path.join(rootDir, folder);

  if (folderExists(folderPath)) {
    msg.err(`'${folder}' 폴더가 이미 존재합니다`);
    return;
  }

  blank();

  // PR 브랜치 fetch
  await withSpinner('PR 브랜치 fetch 중...', () =>
    fetchPRBranch(bareDir, selectedPR.number)
  );

  // 워크트리 생성
  const result = await withSpinner('워크트리 생성 중...', () =>
    createWorktreeWithExistingBranch(bareDir, folder, `pr-${selectedPR.number}`)
  );

  if (!result.success) {
    msg.err('워크트리 생성 실패');
    return;
  }

  msg.ok(`워크트리 생성 완료: ${colors.bold(folder)}`);

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

/**
 * PR 리뷰 명령어
 */
async function prReview() {
  const rootDir = process.cwd();
  const bareDir = getBareDir(rootDir);

  // gh CLI 확인
  if (!isGhInstalled()) {
    msg.err('gh CLI가 설치되어 있지 않습니다');
    msg.info('설치: brew install gh');
    return;
  }

  // bare repo 확인
  if (!isBareRepoExists(rootDir)) {
    msg.err("'.bare' 폴더가 없습니다");
    return;
  }

  box(`${icons.review} PR 리뷰`);

  // 원격 저장소 동기화
  await withSpinner('원격 저장소 동기화 중...', () => fetchOrigin(bareDir));

  // 서브메뉴 루프
  while (true) {
    const choice = await prReviewSubMenu();

    if (!choice) {
      return;
    }

    if (choice === 'open') {
      await prListByState('open', 'Open');
    } else if (choice === 'closed') {
      await prListByState('closed', 'Closed');
    }

    blank();
  }
}

module.exports = { prReview };
