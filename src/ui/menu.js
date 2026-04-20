const path = require('path');
const execa = require('execa');
const prompts = require('prompts');
const { header, divider, blank, colors } = require('./output');
const { loadConfig, configExists, getActivePath } = require('../utils/config-file');
const { getLatestVersionFromCache, fetchLatestVersionAsync } = require('../services/update-check');
const { MENU_CHOICES } = require('../utils/constants');

async function getActiveStatus(rootDir) {
  const activePath = getActivePath(rootDir);
  if (!activePath) return null;

  const name = path.basename(activePath);
  let badge = '';
  try {
    const { stdout } = await execa('git', ['-C', activePath, 'status', '--short'], { reject: false });
    const count = stdout.trim().split('\n').filter(Boolean).length;
    badge = count === 0 ? colors.success('[clean]') : colors.warn(`[${count} changes]`);
  } catch {}

  return { name, badge };
}

function showUpdateNotice(rootDir) {
  const currentVersion = require('../../package.json').version;
  const latestVersion = getLatestVersionFromCache(rootDir);
  if (latestVersion && latestVersion !== currentVersion) {
    console.log(`  ${colors.warn('↑')} ${colors.dim('새 버전 출시:')} ${colors.info(`v${latestVersion}`)} ${colors.dim('→ npm i -g @rawvv/grove')}`);
  }
  fetchLatestVersionAsync(rootDir);
}

async function showDashboard(rootDir = process.cwd()) {
  blank();

  const active = await getActiveStatus(rootDir);
  if (active) {
    console.log(`  ${colors.success('●')} ${colors.bold('active')}  ${colors.info(active.name)} ${active.badge}`);
  } else {
    console.log(`  ${colors.dim('○')} ${colors.dim('active  없음')}`);
  }

  if (configExists(rootDir)) {
    const config = loadConfig(rootDir);
    console.log(`  ${colors.dim('◎')} ${colors.dim('base')}    ${colors.info(config.DEFAULT_BASE_BRANCH)}  ${colors.dim('│  prefix')}  ${colors.info(config.DEFAULT_BRANCH_PREFIX)}`);
  } else {
    console.log(`  ${colors.dim('◎')} ${colors.dim('설정: 기본값 사용')}`);
  }

  showUpdateNotice(rootDir);
}

function showMenuChoices() {
  blank();
  divider();
  blank();

  MENU_CHOICES.forEach((choice, index) => {
    if (choice.value === 'quit') {
      console.log(`    ${colors.dim('q')}  ${colors.dim('종료')}`);
    } else {
      console.log(`    ${colors.bold(index + 1)}  ${choice.title}`);
    }
  });

  blank();
  divider();
  console.log(`  ${colors.dim('?  도움말')}   ${colors.dim("Ctrl+C  이전 메뉴")}`);
  blank();
}

async function mainMenu(rootDir = process.cwd()) {
  console.clear();

  header();
  await showDashboard(rootDir);
  showMenuChoices();

  const response = await prompts({
    type: 'text',
    name: 'choice',
    message: '선택'
  });

  const input = (response.choice || '').trim().toLowerCase();

  if (input === '?') return 'help';
  if (input === 'q') return 'quit';

  const num = parseInt(input);
  if (!isNaN(num) && num >= 1 && num <= MENU_CHOICES.length - 1) {
    return MENU_CHOICES[num - 1].value;
  }

  const matchedChoice = MENU_CHOICES.find(c => c.value === input);
  if (matchedChoice) return matchedChoice.value;

  return null;
}

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
  showDashboard,
  showMenuChoices
};
