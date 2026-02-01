const prompts = require('prompts');
const ora = require('ora');
const { isGitInstalled, isValidGitUrl, isBareRepoExists, cloneBareRepo } = require('../services/git');
const { config } = require('./config');
const { colors, step, msg, blank } = require('../ui/output');

/**
 * init 명령어 - 인터랙티브 flow
 */
async function init() {
  console.log('');
  console.log(`  ${colors.bold(colors.info('git-grove init'))}`);
  console.log(`  ${colors.dim('─────────────────────────────────')}`);

  // ========================================
  // [1/3] 환경 체크
  // ========================================
  step(1, 3, '환경을 확인하고 있어요...');

  if (!isGitInstalled()) {
    msg.err('Git이 설치되어 있지 않아요.');
    console.log('');
    console.log(`  ${colors.dim('Git 설치: https://git-scm.com/downloads')}`);
    console.log('');
    process.exit(1);
  }
  msg.ok('Git 확인 완료');

  // .bare 디렉토리 존재 확인
  if (isBareRepoExists()) {
    msg.err('이미 초기화된 프로젝트예요.');
    console.log('');
    console.log(`  ${colors.dim('.bare 디렉토리가 이미 존재합니다.')}`);
    console.log('');
    process.exit(1);
  }
  msg.ok('초기화 가능');

  // ========================================
  // [2/3] Git 저장소 주소 입력
  // ========================================
  step(2, 3, 'Git 저장소 주소를 입력해 주세요');
  console.log('');

  const response = await prompts({
    type: 'text',
    name: 'gitUrl',
    message: '저장소 URL',
    validate: (value) => {
      if (!value) return '저장소 URL을 입력해 주세요.';
      if (!isValidGitUrl(value)) return '올바른 Git 저장소 주소가 아닌 것 같아요.';
      return true;
    }
  });

  if (!response.gitUrl) {
    console.log('');
    console.log(`  ${colors.dim('취소되었어요.')}`);
    console.log('');
    process.exit(0);
  }

  // ========================================
  // [3/3] 저장소 복제
  // ========================================
  step(3, 3, '저장소를 복제하고 있어요...');

  const spinner = ora({
    text: '복제 중...',
    indent: 8
  }).start();

  const cloneResult = await cloneBareRepo(response.gitUrl);

  if (!cloneResult.success) {
    spinner.fail(cloneResult.error);
    console.log('');
    process.exit(1);
  }

  spinner.succeed('저장소 복제 완료!');

  // ========================================
  // 연결 설정 여부 확인
  // ========================================
  console.log('');
  const configResponse = await prompts({
    type: 'confirm',
    name: 'setupConfig',
    message: '연결 설정을 바로 하시겠어요?',
    initial: true
  });

  if (configResponse.setupConfig) {
    await config();
  }

  // ========================================
  // 완료 메시지
  // ========================================
  console.log('');
  console.log(`  ${colors.success('✓')} ${colors.bold('모든 준비가 완료됐어요!')}`);
  console.log('');
  console.log(`  ${colors.dim('다음 단계:')}`);
  console.log(`    ${colors.info('git-grove')} ${colors.dim('를 실행해 보세요.')}`);
  console.log('');
}

module.exports = { init };
