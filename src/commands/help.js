const { box, section, colors, blank } = require('../ui/output');

async function help() {
  box('🌳 GROVE 도움말');

  section('커맨드');
  const commands = [
    ['create',    '새 워크트리 생성 (브랜치 선택/생성 포함)'],
    ['remove',    '워크트리 삭제'],
    ['list',      '워크트리 목록 + 현재 상태'],
    ['link',      '설정된 파일 복사 (FILES)'],
    ['config',    '.worktree.config 초기화'],
    ['pr-review', 'PR 리뷰용 임시 워크트리 생성'],
    ['help',      '이 도움말 표시'],
  ];
  for (const [cmd, desc] of commands) {
    console.log(`    ${colors.info(cmd.padEnd(12))} ${colors.dim(desc)}`);
  }

  section('.worktree.config 설정 가이드');
  console.log(`  ${colors.dim('파일 위치: 프로젝트 루트/.worktree.config')}`);
  blank();

  const lines = [
    'BARE_DIR=".bare"               # bare repo 폴더명',
    'DEFAULT_BASE_BRANCH="main"     # 기본 base 브랜치',
    'DEFAULT_BRANCH_PREFIX="feat/"  # 브랜치 자동 prefix',
    '',
    'FILES=(',
    '  ".env:.env"                  # 소스:대상 (worktree 생성 시 복사)',
    ')',
    '',
    'PRE_SWITCH_COMMANDS=(',
    '  "docker-compose down"        # 새 워크트리 생성 전 실행',
    ')',
    '',
    'POST_CREATE_COMMANDS=(',
    '  "docker-compose up -d"       # 새 워크트리 생성 후 실행',
    ')',
  ];
  for (const line of lines) {
    console.log(`    ${colors.dim(line)}`);
  }

  blank();
}

module.exports = { help };
