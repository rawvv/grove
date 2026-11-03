const fs = require('fs');
const path = require('path');
const net = require('net');
const execa = require('execa');
const { loadConfig, getActivePath } = require('../utils/config-file');

const COMPOSE_NAMES = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'];
const ENV_KEY = 'GROVE_WORKTREE';

/**
 * compose 파일의 최상위 섹션별 자식 키와 서비스별 short syntax 포트를 뽑는다
 * ponytail: 2-space 블록 YAML·short syntax 포트만 지원. 깨지면 `docker compose config --format json`으로 교체
 * @returns {{services: string[], volumes: string[], networks: string[], ports: Object<string, string[]>}}
 */
function parseCompose(content) {
  const out = { services: [], volumes: [], networks: [], ports: {} };
  let section = null;
  let service = null;
  let inPorts = false;
  for (const raw of content.split('\n')) {
    const line = raw.replace(/\s+#.*$/, '').trimEnd();
    if (!line || line.startsWith('#')) continue;
    const top = line.match(/^([\w-]+):/);
    if (top) { section = out[top[1]] ? top[1] : null; service = null; continue; }
    const child = section && line.match(/^  ([\w.-]+):/);
    if (child) { out[section].push(child[1]); service = section === 'services' ? child[1] : null; continue; }
    if (!service) continue;
    if (/^    \S/.test(line)) { inPorts = line === '    ports:'; continue; }
    const port = inPorts && line.match(/^      - ["']?([^"'\s]+)["']?$/);
    if (!port) continue;
    if (!out.ports[service]) out.ports[service] = [];
    out.ports[service].push(port[1]);
  }
  return out;
}

/**
 * 레포 안의 compose 파일 읽기. 워크트리가 없으면 bare repo HEAD에서 읽는다
 * @returns {Promise<{name: string, content: string}|null>}
 */
async function readComposeSource(rootDir, bareDir) {
  const active = getActivePath(rootDir);
  const dirs = [active, ...fs.readdirSync(rootDir).map(d => path.join(rootDir, d))].filter(Boolean);
  for (const dir of dirs) {
    for (const name of COMPOSE_NAMES) {
      const file = path.join(dir, name);
      if (fs.existsSync(file) && fs.existsSync(path.join(dir, '.git'))) {
        return { name, content: fs.readFileSync(file, 'utf-8') };
      }
    }
  }
  for (const name of COMPOSE_NAMES) {
    try {
      const { stdout } = await execa('git', ['-C', bareDir, 'show', `HEAD:${name}`]);
      return { name, content: stdout };
    } catch { /* 다음 이름 시도 */ }
  }
  return null;
}

/**
 * PORTS 항목("서비스:호스트:컨테이너")을 서비스별 포트 목록으로 묶는다
 * @returns {Object<string, string[]>}
 */
function groupPortsByService(ports = []) {
  const portsByService = {};
  for (const entry of ports) {
    const [service, ...mapping] = entry.split(':');
    if (mapping.length === 0) continue;
    if (!portsByService[service]) portsByService[service] = [];
    portsByService[service].push(mapping.join(':'));
  }
  return portsByService;
}

function isPortFree(port) {
  return new Promise(resolve => {
    const server = net.createServer();
    // EACCES(특권 포트) 등은 판단 불가라 비어 있다고 간주
    server.once('error', err => resolve(err.code !== 'EADDRINUSE'));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port);
  });
}

async function findFreePort(startPort, reserved) {
  for (let port = startPort; port < startPort + 100; port++) {
    if (!reserved.has(port) && await isPortFree(port)) return port;
  }
  return null;
}

/**
 * 레포 compose의 호스트 포트 중 사용 중인 것을 빈 포트로 바꾼 PORTS 항목 생성
 * ponytail: 생성 시점 기준. 꺼져 있던 다른 bare가 나중에 뜨면 충돌 가능 → grove docker로 재생성
 * @returns {Promise<{ports: string[], reassigned: string[]}>} ports는 "서비스:호스트:컨테이너" 형식
 */
async function assignFreePorts(parsed, manualPorts = []) {
  const manualServices = Object.keys(groupPortsByService(manualPorts));
  const reserved = new Set(manualPorts.map(entry => Number(entry.split(':').slice(-2)[0])));
  const ports = [];
  const reassigned = [];

  for (const [service, mappings] of Object.entries(parsed.ports)) {
    if (manualServices.includes(service)) continue;
    const serviceMappings = [];
    let changed = false;
    for (const mapping of mappings) {
      const parts = mapping.split(':');
      const hostPort = Number(parts[parts.length - 2]);
      if (!Number.isInteger(hostPort)) { serviceMappings.push(mapping); continue; }
      const freePort = await findFreePort(hostPort, reserved);
      if (freePort === null) { serviceMappings.push(mapping); continue; }
      reserved.add(freePort);
      if (freePort !== hostPort) {
        changed = true;
        reassigned.push(`${service} ${hostPort}→${freePort}`);
      }
      parts[parts.length - 2] = String(freePort);
      serviceMappings.push(parts.join(':'));
    }
    // 바뀐 서비스만 !override로 출력
    if (changed) ports.push(...serviceMappings.map(mapping => `${service}:${mapping}`));
  }
  return { ports, reassigned };
}

/**
 * 루트용 compose 파일 생성 — 레포 compose를 extends로 참조
 */
function generateRootCompose(parsed, composeName, ports = []) {
  const portsByService = groupPortsByService(ports);
  const lines = [
    '# grove가 생성한 파일 — 워크트리 전환은 .env의 GROVE_WORKTREE로 결정됩니다',
    `# 레포의 ${composeName}을 extends로 참조하므로 상대경로는 워크트리 폴더 기준으로 풀립니다`,
    'services:'
  ];
  for (const svc of parsed.services) {
    lines.push(`  ${svc}:`, '    extends:', `      file: \${${ENV_KEY}}/${composeName}`, `      service: ${svc}`);
    const servicePorts = portsByService[svc];
    if (!servicePorts) continue;
    // extends로 합쳐지는 레포 포트를 지우고 교체
    lines.push('    ports: !override', ...servicePorts.map(port => `      - "${port}"`));
  }
  for (const key of ['volumes', 'networks']) {
    if (parsed[key].length === 0) continue;
    lines.push(`${key}:`);
    for (const name of parsed[key]) lines.push(`  ${name}:`);
  }
  return lines.join('\n') + '\n';
}

/**
 * KEY=value 한 줄 교체/추가 (순수 함수)
 */
function upsertEnv(content, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(content)) return content.replace(re, line);
  const sep = content && !content.endsWith('\n') ? '\n' : '';
  return `${content}${sep}${line}\n`;
}

/**
 * 컨테이너가 현재 바라보는 워크트리 폴더명 (.env의 GROVE_WORKTREE)
 * @returns {string|null}
 */
function readEnvWorktree(rootDir) {
  const envPath = path.join(rootDir, '.env');
  if (!fs.existsSync(envPath)) return null;
  const m = fs.readFileSync(envPath, 'utf-8').match(new RegExp(`^${ENV_KEY}=(.*)$`, 'm'));
  return m ? m[1].trim() : null;
}

function writeEnv(rootDir, folder) {
  const envPath = path.join(rootDir, '.env');
  const current = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
  fs.writeFileSync(envPath, upsertEnv(current, ENV_KEY, folder));
}

/**
 * 단일 컨테이너 모드 셋업: 루트 compose + .env 생성
 * @returns {Promise<{ok: boolean, reason?: string, services?: string[], unknownPortServices?: string[], reassignedPorts?: string[], composePath?: string}>}
 */
async function setupSingleMode(rootDir, bareDir, { overwrite = false } = {}) {
  const composePath = path.join(rootDir, 'docker-compose.yml');
  if (fs.existsSync(composePath) && !overwrite) return { ok: false, reason: 'exists', composePath };

  const source = await readComposeSource(rootDir, bareDir);
  if (!source) return { ok: false, reason: 'no-compose' };

  const parsed = parseCompose(source.content);
  if (parsed.services.length === 0) return { ok: false, reason: 'no-services' };

  const config = loadConfig(rootDir);
  const autoPorts = await assignFreePorts(parsed, config.PORTS);
  fs.writeFileSync(composePath, generateRootCompose(parsed, source.name, [...config.PORTS, ...autoPorts.ports]));
  const active = getActivePath(rootDir);
  writeEnv(rootDir, active ? path.basename(active) : config.DEFAULT_BASE_BRANCH);
  const unknownPortServices = Object.keys(groupPortsByService(config.PORTS))
    .filter(service => !parsed.services.includes(service));
  return { ok: true, services: parsed.services, unknownPortServices, reassignedPorts: autoPorts.reassigned, composePath };
}

/**
 * compose 변수 보간용 --env-file 인자. 루트 .env는 프로젝트 폴더라 기본으로 읽히지만
 * ${MYSQL_PASSWORD} 같은 값은 워크트리 .env에 있으므로 함께 넘긴다.
 * 루트 .env를 뒤에 두어 GROVE_WORKTREE는 항상 루트 값이 이긴다.
 * ponytail: 워크트리 루트의 .env만 본다. 하위 폴더 env가 필요하면 FILES 대상 경로를 순회
 */
function composeEnvArgs(rootDir, folder) {
  const args = [];
  const wtEnv = path.join(rootDir, folder, '.env');
  if (fs.existsSync(wtEnv)) args.push('--env-file', wtEnv);
  args.push('--env-file', path.join(rootDir, '.env'));
  return args;
}

/**
 * 워크트리 전환: .env 갱신 후 루트에서 compose up
 * @param {boolean} [opts.quiet] - stdout을 비워야 할 때(grove cd) docker 출력을 stderr로
 */
async function switchDocker(rootDir, folder, { quiet = false } = {}) {
  if (loadConfig(rootDir).DOCKER_MODE !== 'single') return { skipped: true };
  writeEnv(rootDir, folder);
  try {
    await execa('docker', ['compose', ...composeEnvArgs(rootDir, folder), 'up', '-d'], {
      cwd: rootDir,
      stdio: quiet ? ['inherit', 2, 2] : 'inherit'
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.shortMessage || err.message };
  }
}

module.exports = { parseCompose, upsertEnv, generateRootCompose, assignFreePorts, setupSingleMode, switchDocker, readEnvWorktree, composeEnvArgs, ENV_KEY };
