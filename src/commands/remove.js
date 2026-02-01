const path = require('path');
const { box, section, msg, colors, icons, blank } = require('../ui/output');
const { selectWorktree, confirm } = require('../ui/prompts');
const { withSpinner } = require('../ui/spinner');
const { getWorktreesExcludeBare, removeWorktree, getWorktreeBranch } = require('../services/worktree');
const { deleteBranch } = require('../services/branch');
const { fetchOrigin, isBareRepoExists } = require('../services/git');
const { getBareDir } = require('../utils/config-file');
const { isProtectedBranch } = require('../utils/validators');

/**
 * 워크트리 삭제 명령어
 */
async function remove() {
  const rootDir = process.cwd();
  const bareDir = getBareDir(rootDir);

  // bare repo 확인
  if (!isBareRepoExists(rootDir)) {
    msg.err("'.bare' 폴더가 없습니다");
    return;
  }

  box(`${icons.trash} 워크트리 삭제`);

  // 원격 저장소 동기화
  await withSpinner('원격 저장소 동기화 중...', () => fetchOrigin(bareDir));

  // 워크트리 목록 조회
  const worktrees = await getWorktreesExcludeBare(bareDir);

  if (worktrees.length === 0) {
    msg.err('삭제할 워크트리가 없습니다');
    return;
  }

  // 워크트리 선택
  section('워크트리 선택');
  const folder = await selectWorktree(worktrees);

  if (!folder) {
    msg.warn('취소됨');
    return;
  }

  // 선택한 워크트리의 브랜치 확인
  const worktreePath = path.join(rootDir, folder);
  const branch = await getWorktreeBranch(worktreePath);

  // 삭제 확인
  blank();
  console.log(`  ${colors.error(colors.bold('정말 삭제할까요?'))}`);
  console.log(`    ${icons.folder} ${folder}`);
  console.log(`    ${icons.branch} ${branch}`);

  blank();
  const proceed = await confirm(colors.error('삭제 진행?'), false);

  if (!proceed) {
    msg.warn('취소됨');
    return;
  }

  // 워크트리 삭제
  blank();
  const result = await withSpinner('워크트리 삭제 중...', () =>
    removeWorktree(bareDir, folder)
  );

  if (!result.success) {
    msg.err('삭제 실패');
    return;
  }

  msg.ok('워크트리 삭제 완료');

  // 보호 브랜치가 아닌 경우 브랜치 삭제 여부 확인
  if (branch && !isProtectedBranch(branch)) {
    blank();
    const deleteBranchConfirm = await confirm(`브랜치 '${branch}'도 삭제?`, false);

    if (deleteBranchConfirm) {
      const branchResult = await deleteBranch(bareDir, branch);
      if (branchResult.success) {
        msg.ok('브랜치 삭제 완료');
      } else {
        msg.err('브랜치 삭제 실패');
      }
    }
  }
}

module.exports = { remove };
