// 기본 설정값
const DEFAULTS = {
  BARE_DIR: '.bare',
  BASE_BRANCH: 'main',
  BRANCH_PREFIX: 'feat/',
  CONFIG_FILE: '.worktree.config'
};

// 보호 브랜치 목록
const PROTECTED_BRANCHES = [
  'main',
  'master',
  'dev',
  'develop',
  'staging',
  'production'
];

// 메뉴 선택지
const MENU_CHOICES = [
  { title: '📁  워크트리 생성', value: 'create' },
  { title: '🔗  파일 연결', value: 'link' },
  { title: '🗑️   워크트리 삭제', value: 'remove' },
  { title: '📋  목록 보기', value: 'list' },
  { title: '⚙️   설정 초기화', value: 'config' },
  { title: '🔍  PR 리뷰', value: 'pr-review' },
  { title: '종료', value: 'quit' }
];

// PR 상태
const PR_STATES = {
  OPEN: 'open',
  CLOSED: 'closed'
};

module.exports = {
  DEFAULTS,
  PROTECTED_BRANCHES,
  MENU_CHOICES,
  PR_STATES
};
