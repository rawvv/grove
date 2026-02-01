const { box, section, msg, colors, icons, blank } = require('../ui/output');
const { selectWorktree } = require('../ui/prompts');
const { progressBar } = require('../ui/spinner');
const { getWorktreesExcludeBare } = require('../services/worktree');
const { linkFilesToWorktree } = require('../services/symlink');
const { isBareRepoExists } = require('../services/git');
const { loadConfig, getBareDir } = require('../utils/config-file');

/**
 * 파일 연결 (symlink) 명령어
 * @param {string} targetFolder - 대상 폴더 (선택적)
 */
async function link(targetFolder = null) {
  const rootDir = process.cwd();
  const bareDir = getBareDir(rootDir);
  const config = loadConfig(rootDir);

  // 설정 확인
  if (!config.SYMLINKS || config.SYMLINKS.length === 0) {
    msg.warn('설정된 symlink가 없습니다');
    msg.info('.worktree.config 파일을 생성하세요');
    return;
  }

  let folder = targetFolder;

  if (!folder) {
    // bare repo 확인
    if (!isBareRepoExists(rootDir)) {
      msg.err("'.bare' 폴더가 없습니다");
      return;
    }

    box(`${icons.link} 파일 연결 (Symlink)`);

    // 워크트리 목록 조회
    const worktrees = await getWorktreesExcludeBare(bareDir);

    if (worktrees.length === 0) {
      msg.err('워크트리가 없습니다');
      return;
    }

    // 워크트리 선택
    section('워크트리 선택');
    folder = await selectWorktree(worktrees);

    if (!folder) {
      msg.warn('취소됨');
      return;
    }
  }

  section('Symlink 연결');

  // 프로그레스 표시하며 연결
  const total = config.SYMLINKS.length;
  const results = [];

  for (let i = 0; i < total; i++) {
    process.stdout.write(`\r  ${progressBar(i + 1, total)}`);

    const symlinkResults = await linkFilesToWorktree(rootDir, folder, [config.SYMLINKS[i]]);
    results.push(...symlinkResults);

    // 약간의 딜레이 (시각적 효과)
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(''); // 줄바꿈
  blank();

  // 결과 출력
  for (const r of results) {
    const [src, dest] = r.mapping.split(':');

    if (r.success) {
      console.log(`    ${colors.success(icons.check)} ${src} ${icons.arrow} ${folder}/${dest}`);
    } else {
      console.log(`    ${colors.error(icons.cross)} ${src} ${colors.dim(`(${r.error})`)}`);
    }
  }

  blank();
  msg.ok('연결 완료');
}

module.exports = { link };
