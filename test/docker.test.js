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
