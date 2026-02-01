const { box, section, msg, colors, icons, blank } = require('../ui/output');
const { inputText, confirm } = require('../ui/prompts');
const { loadConfig, saveConfig, configExists } = require('../utils/config-file');
const { validateSymlinkMapping } = require('../utils/validators');
const { DEFAULTS } = require('../utils/constants');

/**
 * 설정 초기화 명령어
 */
async function config() {
  const rootDir = process.cwd();

  box(`${icons.gear} 설정 초기화`);

  // 기존 설정 파일 확인
  if (configExists(rootDir)) {
    msg.warn('이미 .worktree.config 파일이 존재합니다');

    const overwrite = await confirm('덮어쓸까요?', false);
    if (!overwrite) {
      msg.warn('취소됨');
      return;
    }
  }

  section('기본 설정');

  // Bare repo 디렉토리
  const bareDir = await inputText(`Bare repo 디렉토리 (기본: ${DEFAULTS.BARE_DIR})`);

  // 기본 base 브랜치
  const baseBranch = await inputText(`기본 base 브랜치 (기본: ${DEFAULTS.BASE_BRANCH})`);

  // 브랜치 prefix
  msg.info('브랜치 prefix 예시: feat/, fix/, feature/, hotfix/');
  const branchPrefix = await inputText(`기본 브랜치 prefix (기본: ${DEFAULTS.BRANCH_PREFIX})`);

  section('Symlink 설정');
  msg.info('env 파일이 들어갈 폴더를 지정하세요');
  msg.info('예: backend, frontend, apps/web 등');

  const envFolder = await inputText('env 대상 폴더 (Enter: 루트)');

  const symlinks = [];

  // 기본 .env symlink 추가
  if (!envFolder || envFolder === '.') {
    symlinks.push('.env:.env');
    msg.ok('.env → .env 추가됨');
  } else {
    symlinks.push(`.env:${envFolder}/.env`);
    msg.ok(`.env → ${envFolder}/.env 추가됨`);
  }

  // 추가 symlink 입력
  blank();
  msg.info('추가 symlink가 필요하면 입력하세요');
  msg.info('형식: 소스파일:대상경로 (예: .env.local:backend/.env.local)');
  msg.info('빈 줄 입력시 종료');
  blank();

  while (true) {
    const addMore = await confirm('추가 symlink를 설정할까요?', false);

    if (!addMore) break;

    const mapping = await inputText('symlink 추가 (소스:대상)');

    if (!mapping) break;

    const validation = validateSymlinkMapping(mapping);
    if (validation !== true) {
      msg.err(validation);
      continue;
    }

    symlinks.push(mapping);
    msg.ok('추가됨');
  }

  // 설정 저장
  const newConfig = {
    BARE_DIR: bareDir || DEFAULTS.BARE_DIR,
    DEFAULT_BASE_BRANCH: baseBranch || DEFAULTS.BASE_BRANCH,
    DEFAULT_BRANCH_PREFIX: branchPrefix || DEFAULTS.BRANCH_PREFIX,
    SYMLINKS: symlinks
  };

  const success = saveConfig(newConfig, rootDir);

  if (success) {
    blank();
    msg.ok('.worktree.config 생성 완료');

    section('생성된 설정');
    console.log(`    ${colors.dim('BARE_DIR:')} ${newConfig.BARE_DIR}`);
    console.log(`    ${colors.dim('DEFAULT_BASE_BRANCH:')} ${newConfig.DEFAULT_BASE_BRANCH}`);
    console.log(`    ${colors.dim('DEFAULT_BRANCH_PREFIX:')} ${newConfig.DEFAULT_BRANCH_PREFIX}`);
    blank();
    console.log(`    ${colors.dim('SYMLINKS:')}`);
    for (const s of newConfig.SYMLINKS) {
      console.log(`      ${s}`);
    }
  } else {
    msg.err('설정 파일 생성 실패');
  }
}

module.exports = { config };
