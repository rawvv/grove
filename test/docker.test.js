const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCompose, upsertEnv, generateRootCompose } = require('../src/services/docker');

test('parseCompose: 서비스/볼륨/네트워크 이름 추출', () => {
  const yml = `
version: "3.9"   # 무시
services:
  app:
    build: .
    volumes:
      - .:/app
  db:
    image: postgres
volumes:
  pgdata:
networks:
  internal:
    driver: bridge
`;
  assert.deepEqual(parseCompose(yml), {
    services: ['app', 'db'], volumes: ['pgdata'], networks: ['internal']
  });
});

test('upsertEnv: 있으면 교체, 없으면 추가', () => {
  assert.equal(upsertEnv('A=1\nGROVE_WORKTREE=main\n', 'GROVE_WORKTREE', 'feat'), 'A=1\nGROVE_WORKTREE=feat\n');
  assert.equal(upsertEnv('A=1', 'GROVE_WORKTREE', 'feat'), 'A=1\nGROVE_WORKTREE=feat\n');
  assert.equal(upsertEnv('', 'GROVE_WORKTREE', 'feat'), 'GROVE_WORKTREE=feat\n');
});

test('generateRootCompose: extends 참조 생성', () => {
  const out = generateRootCompose({ services: ['app'], volumes: ['data'], networks: [] }, 'compose.yaml');
  assert.match(out, /file: \$\{GROVE_WORKTREE\}\/compose\.yaml/);
  assert.match(out, /service: app/);
  assert.match(out, /volumes:\n  data:/);
  assert.doesNotMatch(out, /networks:/);
});

test('readEnvWorktree: .env에서 GROVE_WORKTREE 읽기', () => {
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const { readEnvWorktree } = require('../src/services/docker');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grove-'));
  assert.equal(readEnvWorktree(dir), null);
  fs.writeFileSync(path.join(dir, '.env'), 'A=1\nGROVE_WORKTREE=feat-x\n');
  assert.equal(readEnvWorktree(dir), 'feat-x');
});

test('composeEnvArgs: 워크트리 .env가 있으면 먼저, 루트 .env는 항상 마지막', () => {
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const { composeEnvArgs } = require('../src/services/docker');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'grove-'));
  assert.deepEqual(composeEnvArgs(root, 'wt'), ['--env-file', path.join(root, '.env')]);
  fs.mkdirSync(path.join(root, 'wt'));
  fs.writeFileSync(path.join(root, 'wt', '.env'), 'X=1');
  assert.deepEqual(composeEnvArgs(root, 'wt'),
    ['--env-file', path.join(root, 'wt', '.env'), '--env-file', path.join(root, '.env')]);
});
