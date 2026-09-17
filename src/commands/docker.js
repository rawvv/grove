const prompts = require('prompts');
const { box, section, msg, colors, blank } = require('../ui/output');
const { confirm } = require('../ui/prompts');
const { findRootDir, getBareDir, loadConfig, saveConfig } = require('../utils/config-file');
const { setupSingleMode, ENV_KEY } = require('../services/docker');

const REASONS = {
  'no-compose': '레포에서 docker-compose.yml / compose.yaml을 찾지 못했습니다',
  'no-services': 'compose 파일에서 services를 읽지 못했습니다 (2-space 들여쓰기만 지원)'
};

/**
 * Docker 모드 설정 명령어
 */
async function docker() {
  const rootDir = findRootDir();
  const config = loadConfig(rootDir);

  box('🐳 Docker 모드 설정');

  const { mode } = await prompts({
    type: 'select',
    name: 'mode',
    message: '워크트리 전환 시 Docker를 어떻게 다룰까요?',
    initial: ['single', 'perWorktree', ''].indexOf(config.DOCKER_MODE),
    choices: [
      { title: '단일 컨테이너 (권장)', description: '컨테이너 1개, grove cd/create 시 바라보는 워크트리만 교체', value: 'single' },
      { title: '워크트리별 컨테이너', description: '기존 방식. PRE_SWITCH/POST_CREATE 훅으로 down/up', value: 'perWorktree' },
      { title: '사용 안 함', value: '' }
    ]
  });
  if (mode === undefined) return;

  if (mode === 'single') {
    let result = await setupSingleMode(rootDir, getBareDir(rootDir));
    if (!result.ok && result.reason === 'exists') {
      msg.warn('루트에 docker-compose.yml이 이미 있습니다');
      const overwrite = await confirm('grove 버전으로 덮어쓸까요?', false);
      result = overwrite
        ? await setupSingleMode(rootDir, getBareDir(rootDir), { overwrite: true })
        : { ok: true, kept: true };
    }
    if (!result.ok) {
      msg.err(REASONS[result.reason] || result.reason);
      return;
    }
    if (!result.kept) {
      msg.ok(`생성: ${colors.bold('docker-compose.yml')} (services: ${result.services.join(', ')})`);
      msg.ok(`생성: ${colors.bold('.env')} → ${ENV_KEY}`);
    }
  } else if (mode === 'perWorktree') {
    msg.info('.worktree.config의 PRE_SWITCH_COMMANDS / POST_CREATE_COMMANDS를 사용합니다');
  }

  saveConfig({ ...config, DOCKER_MODE: mode }, rootDir);
  blank();
  msg.ok(`DOCKER_MODE="${mode}" 저장 완료`);

  if (mode === 'single') {
    section('다음 단계');
    console.log(`    ${colors.dim('docker 명령은 항상 루트 폴더에서 실행하세요. 워크트리 안에서 up 하면 컨테이너가 하나 더 생깁니다.')}`);
    console.log(`    ${colors.info('grove cd <이름>')} ${colors.dim('또는')} ${colors.info('grove create')} ${colors.dim('가 자동으로 up -d 합니다')}`);
  }
}

module.exports = { docker };
