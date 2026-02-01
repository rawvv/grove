const { mainMenu } = require('./ui/menu');
const { msg, blank, colors } = require('./ui/output');
const { pressEnterToContinue } = require('./ui/prompts');

const { create } = require('./commands/create');
const { remove } = require('./commands/remove');
const { list } = require('./commands/list');
const { link } = require('./commands/link');
const { config } = require('./commands/config');
const { prReview } = require('./commands/pr-review');

/**
 * 명령어 실행
 * @param {string} command - 명령어
 */
async function executeCommand(command) {
  try {
    switch (command) {
      case 'create':
        await create();
        break;
      case 'remove':
        await remove();
        break;
      case 'list':
        await list();
        break;
      case 'link':
        await link();
        break;
      case 'config':
        await config();
        break;
      case 'pr-review':
        await prReview();
        break;
      case 'quit':
        console.log(`\n  👋 ${colors.dim('Bye!')}\n`);
        process.exit(0);
      default:
        if (command !== null) {
          msg.err('잘못된 선택');
        }
    }
  } catch (error) {
    if (error.message !== 'canceled') {
      msg.err(`오류 발생: ${error.message}`);
    }
  }
}

/**
 * 메인 루프
 */
async function main() {
  while (true) {
    const choice = await mainMenu();

    if (choice === 'quit') {
      console.log(`\n  👋 ${colors.dim('Bye!')}\n`);
      break;
    }

    await executeCommand(choice);

    if (choice && choice !== 'quit') {
      blank();
      await pressEnterToContinue();
    }
  }
}

/**
 * 단일 명령어 실행 (CLI 서브커맨드용)
 * @param {string} command - 명령어
 */
async function runCommand(command) {
  await executeCommand(command);
}

module.exports = { main, runCommand };
