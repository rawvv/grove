const prompts = require('prompts');
const { header, divider, blank, colors } = require('./output');
const { loadConfig, configExists } = require('../utils/config-file');
const { MENU_CHOICES } = require('../utils/constants');

/**
 * 설정 상태 표시
 * @param {string} rootDir - 루트 디렉토리
 */
function showConfigStatus(rootDir = process.cwd()) {
  blank();

  if (configExists(rootDir)) {
    const config = loadConfig(rootDir);
    console.log(`  ${colors.success('●')} ${colors.dim('설정:')} .worktree.config`);
    console.log(`    ${colors.dim('base:')} ${colors.info(config.DEFAULT_BASE_BRANCH)} ${colors.dim('│ prefix:')} ${colors.info(config.DEFAULT_BRANCH_PREFIX)}`);
  } else {
    console.log(`  ${colors.warn('○')} ${colors.dim('설정: 기본값 사용')}`);
  }
}

/**
 * 메뉴 선택지 표시
 */
function showMenuChoices() {
  blank();
  divider();
  blank();

  MENU_CHOICES.forEach((choice, index) => {
    if (choice.value === 'quit') {
      blank();
      console.log(`    ${colors.dim('q')}  ${colors.dim('종료')}`);
    } else {
      console.log(`    ${colors.bold(index + 1)}  ${choice.title}`);
    }
  });

  blank();
  divider();
  console.log(`  ${colors.dim("💡 하위 메뉴에서 'Ctrl+C' 입력 시 이전 메뉴로")}`);
  blank();
}

/**
 * 메인 메뉴 표시
 * @param {string} rootDir - 루트 디렉토리
 * @returns {Promise<string|null>}
 */
async function mainMenu(rootDir = process.cwd()) {
  console.clear();

  header();
  showConfigStatus(rootDir);
  showMenuChoices();

  const response = await prompts({
    type: 'text',
    name: 'choice',
    message: '선택'
  });

  const input = (response.choice || '').trim().toLowerCase();

  // 숫자 입력 처리
  const num = parseInt(input);
  if (!isNaN(num) && num >= 1 && num <= MENU_CHOICES.length - 1) {
    return MENU_CHOICES[num - 1].value;
  }

  // 문자 입력 처리
  if (input === 'q') {
    return 'quit';
  }

  // 직접 명령어 입력
  const matchedChoice = MENU_CHOICES.find(c => c.value === input);
  if (matchedChoice) {
    return matchedChoice.value;
  }

  return null;
}

/**
 * PR 리뷰 서브메뉴 표시
 * @returns {Promise<'open'|'closed'|null>}
 */
async function prReviewSubMenu() {
  blank();
  console.log(`    ${colors.bold('1')}  ${colors.success('●')} Open PR`);
  console.log(`    ${colors.bold('2')}  ${colors.error('●')} Closed PR`);
  blank();
  console.log(`    ${colors.dim('z')}  ${colors.dim('이전 메뉴')}`);
  blank();

  const response = await prompts({
    type: 'text',
    name: 'choice',
    message: '선택'
  });

  const input = (response.choice || '').trim().toLowerCase();

  if (input === '1') return 'open';
  if (input === '2') return 'closed';
  if (input === 'z') return null;

  return null;
}

module.exports = {
  mainMenu,
  prReviewSubMenu,
  showConfigStatus,
  showMenuChoices
};
