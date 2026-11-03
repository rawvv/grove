const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCompose, upsertEnv, generateRootCompose } = require('../src/services/docker');

test('parseCompose: 서비스/볼륨/네트워크 이름 추출', () => {
  const yml = `
version: "3.9"   # 무시
services:
  app:
    build: .
    ports:
      - "8080:80"
      - 127.0.0.1:9229:9229
      - target: 443
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
    services: ['app', 'db'], volumes: ['pgdata'], networks: ['internal'],
    ports: { app: ['8080:80', '127.0.0.1:9229:9229'] }
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

test('generateRootCompose: PORTS 있는 서비스만 ports !override 블록 출력', () => {
  const parsed = { services: ['nginx', 'mysql', 'redis'], volumes: [], networks: [] };
  const ports = ['nginx:8100:80', 'nginx:8443:443', 'mysql:3308:3306', 'ghost:1:1'];

  const withPorts = generateRootCompose(parsed, 'docker-compose.yml', ports);
  assert.match(withPorts, /service: nginx\n    ports: !override\n      - "8100:80"\n      - "8443:443"\n/);
  assert.match(withPorts, /service: mysql\n    ports: !override\n      - "3308:3306"\n/);
  assert.match(withPorts, /service: redis\n$/);
  assert.doesNotMatch(withPorts, /ghost/);

  const withoutPorts = generateRootCompose(parsed, 'docker-compose.yml');
  assert.doesNotMatch(withoutPorts, /ports:/);
});

test('assignFreePorts: 사용 중인 호스트 포트만 빈 포트로 교체, PORTS 지정 서비스는 제외', async () => {
  const net = require('node:net');
  const { assignFreePorts } = require('../src/services/docker');
  const blocker = net.createServer().listen(0);
  await new Promise(resolve => blocker.once('listening', resolve));
  const busyPort = blocker.address().port;

  const parsed = { ports: { web: [`${busyPort}:80`, '9:9/udp'], db: [`${busyPort}:3306`], api: ['3000'] } };
  const { ports, reassigned } = await assignFreePorts(parsed, ['db:3308:3306']);
  blocker.close();

  const [webPort] = ports;
  const freePort = Number(webPort.split(':')[1]);
  assert.notEqual(freePort, busyPort);
  assert.deepEqual(ports, [`web:${freePort}:80`, 'web:9:9/udp']);
  assert.deepEqual(reassigned, [`web ${busyPort}→${freePort}`]);
});
