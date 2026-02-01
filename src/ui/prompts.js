const prompts = require('prompts');
const { colors } = require('./output');

// 취소 처리를 위한 옵션
const onCancel = () => {
  return false;
};

/**
 * 텍스트 입력
 * @param {string} message - 프롬프트 메시지
 * @param {Object} options - 추가 옵션
 * @returns {Promise<string|null>}
 */
async function inputText(message, options = {}) {
  const response = await prompts({
    type: 'text',
    name: 'value',
    message,
    initial: options.initial || '',
    validate: options.validate
  }, { onCancel });

  return response.value !== undefined ? response.value : null;
}

/**
 * 폴더명 입력
 * @param {string} message - 프롬프트 메시지
 * @returns {Promise<string|null>}
 */
async function inputFolder(message = '폴더명 입력') {
  return inputText(message, {
    validate: (value) => {
      if (!value || value.trim() === '') return '폴더명을 입력해 주세요.';
      return true;
    }
  });
}

/**
 * 확인 프롬프트
 * @param {string} message - 프롬프트 메시지
 * @param {boolean} initial - 기본값
 * @returns {Promise<boolean>}
 */
async function confirm(message, initial = true) {
  const response = await prompts({
    type: 'confirm',
    name: 'value',
    message,
    initial
  }, { onCancel });

  return response.value === true;
}

/**
 * 선택 프롬프트
 * @param {string} message - 프롬프트 메시지
 * @param {Array<{title: string, value: any, description?: string}>} choices - 선택지
 * @returns {Promise<any|null>}
 */
async function select(message, choices) {
  const response = await prompts({
    type: 'select',
    name: 'value',
    message,
    choices,
    hint: '← → 키로 이동, Enter로 선택'
  }, { onCancel });

  return response.value !== undefined ? response.value : null;
}

/**
 * 브랜치 선택
 * @param {string[]} branches - 브랜치 목록
 * @param {string} defaultBranch - 기본 브랜치
 * @returns {Promise<{type: 'existing'|'new', branch: string}|null>}
 */
async function selectBranch(branches, defaultBranch = 'main') {
  // "새 브랜치 생성"을 첫 번째(기본 선택)로 배치
  const choices = [
    {
      title: colors.info('새 브랜치 생성'),
      value: { type: 'new', branch: '' }
    },
    ...branches.map((branch) => ({
      title: branch === defaultBranch ? `${branch} ${colors.dim('← 분기 기본')}` : branch,
      value: { type: 'existing', branch }
    }))
  ];

  const response = await prompts({
    type: 'select',
    name: 'value',
    message: '브랜치 선택',
    choices,
    hint: '← → 키로 이동, Enter로 선택'
  }, { onCancel });

  return response.value !== undefined ? response.value : null;
}

/**
 * 워크트리 선택
 * @param {Array<{name: string, branch: string}>} worktrees - 워크트리 목록
 * @returns {Promise<string|null>}
 */
async function selectWorktree(worktrees) {
  const choices = worktrees.map(wt => ({
    title: `${wt.name} ${colors.info(`(${wt.branch})`)}`,
    value: wt.name
  }));

  const response = await prompts({
    type: 'select',
    name: 'value',
    message: '워크트리 선택',
    choices,
    hint: '← → 키로 이동, Enter로 선택'
  }, { onCancel });

  return response.value !== undefined ? response.value : null;
}

/**
 * 계속 진행 여부 확인 (Enter to continue)
 * @returns {Promise<void>}
 */
async function pressEnterToContinue() {
  await prompts({
    type: 'invisible',
    name: 'continue',
    message: 'Enter를 눌러 계속...'
  });
}

module.exports = {
  inputText,
  inputFolder,
  confirm,
  select,
  selectBranch,
  selectWorktree,
  pressEnterToContinue
};
