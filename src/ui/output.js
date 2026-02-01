const chalk = require('chalk');

// 색상
const colors = {
  success: chalk.green,
  error: chalk.red,
  warn: chalk.yellow,
  info: chalk.cyan,
  dim: chalk.dim,
  bold: chalk.bold,
  magenta: chalk.magenta
};

// 아이콘
const icons = {
  folder: '📁',
  branch: '🌿',
  link: '🔗',
  trash: '🗑️',
  list: '📋',
  gear: '⚙️',
  check: '✓',
  cross: '✗',
  arrow: '→',
  warn: '⚠',
  review: '🔍',
  tree: '🌳'
};

// 메시지 출력
const msg = {
  ok: (text) => console.log(`  ${colors.success(icons.check)} ${text}`),
  err: (text) => console.log(`  ${colors.error(icons.cross)} ${text}`),
  warn: (text) => console.log(`  ${colors.warn(icons.warn)} ${text}`),
  info: (text) => console.log(`  ${colors.info('ℹ')} ${colors.dim(text)}`)
};

// 박스 그리기
function box(title) {
  const width = 40;
  const line = '─'.repeat(width);
  console.log('');
  console.log(`  ${colors.info('╭' + line + '╮')}`);
  console.log(`  ${colors.info('│')} ${colors.bold(title.padEnd(width - 1))}${colors.info('│')}`);
  console.log(`  ${colors.info('╰' + line + '╯')}`);
}

// 섹션 헤더
function section(title) {
  console.log('');
  console.log(`  ${colors.bold(colors.info('▸'))} ${colors.bold(title)}`);
  console.log(`  ${colors.dim('─'.repeat(38))}`);
}

// 헤더 출력
function header() {
  console.log('');
  console.log(`  ${colors.bold(colors.info('╭───────────────────────────────────╮'))}`);
  console.log(`  ${colors.bold(colors.info('│'))}  ${colors.bold(`${icons.tree} GIT GROVE`)}      ${colors.dim('v0.1.0-beta')}  ${colors.bold(colors.info('│'))}`);
  console.log(`  ${colors.bold(colors.info('╰───────────────────────────────────╯'))}`);
}

// 구분선
function divider() {
  console.log(`  ${colors.dim('───────────────────────────────────────────')}`);
}

// 빈 줄
function blank() {
  console.log('');
}

// 단계 표시
function step(current, total, message) {
  console.log('');
  console.log(`  ${colors.dim(`[${current}/${total}]`)} ${message}`);
}

module.exports = {
  colors,
  icons,
  msg,
  box,
  section,
  header,
  divider,
  blank,
  step
};
