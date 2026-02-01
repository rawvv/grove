const ora = require('ora');

/**
 * 스피너 생성
 * @param {string} text - 스피너 텍스트
 * @returns {ora.Ora}
 */
function createSpinner(text) {
  return ora({
    text,
    indent: 2
  });
}

/**
 * 스피너와 함께 작업 실행
 * @param {string} text - 스피너 텍스트
 * @param {Function} asyncFn - 비동기 함수
 * @returns {Promise<any>}
 */
async function withSpinner(text, asyncFn) {
  const spinner = createSpinner(text);
  spinner.start();

  try {
    const result = await asyncFn();
    spinner.succeed();
    return result;
  } catch (error) {
    spinner.fail();
    throw error;
  }
}

/**
 * 스피너와 함께 작업 실행 (커스텀 성공/실패 메시지)
 * @param {Object} options - 옵션
 * @param {string} options.start - 시작 텍스트
 * @param {string} options.success - 성공 텍스트
 * @param {string} options.fail - 실패 텍스트
 * @param {Function} asyncFn - 비동기 함수
 * @returns {Promise<any>}
 */
async function withSpinnerCustom(options, asyncFn) {
  const spinner = createSpinner(options.start);
  spinner.start();

  try {
    const result = await asyncFn();
    spinner.succeed(options.success);
    return result;
  } catch (error) {
    spinner.fail(options.fail || error.message);
    throw error;
  }
}

/**
 * 프로그레스 바 표시
 * @param {number} current - 현재 값
 * @param {number} total - 전체 값
 * @param {number} width - 바 너비
 * @returns {string}
 */
function progressBar(current, total, width = 30) {
  const pct = Math.floor(current * 100 / total);
  const filled = Math.floor(current * width / total);
  const empty = width - filled;

  const filledBar = '█'.repeat(filled);
  const emptyBar = '░'.repeat(empty);

  return `[${filledBar}${emptyBar}] ${pct.toString().padStart(3)}%`;
}

module.exports = {
  createSpinner,
  withSpinner,
  withSpinnerCustom,
  progressBar
};
