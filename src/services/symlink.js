const fs = require('fs-extra');
const path = require('path');

/**
 * Symlink 매핑 파싱
 * @param {string} mapping - "소스:대상" 형식 문자열
 * @returns {{source: string, dest: string}}
 */
function parseSymlinkMapping(mapping) {
  const [source, dest] = mapping.split(':');
  return { source, dest };
}

/**
 * 워크트리에 symlink 연결
 * @param {string} rootDir - 프로젝트 루트 경로
 * @param {string} worktreeName - 워크트리 폴더명
 * @param {string[]} symlinks - symlink 매핑 배열
 * @returns {Promise<Array<{mapping: string, success: boolean, error?: string}>>}
 */
async function linkFilesToWorktree(rootDir, worktreeName, symlinks) {
  const worktreePath = path.join(rootDir, worktreeName);
  const results = [];

  for (const mapping of symlinks) {
    const { source, dest } = parseSymlinkMapping(mapping);
    const sourcePath = path.join(rootDir, source);
    const destPath = path.join(worktreePath, dest);

    try {
      // 소스 파일 존재 확인
      if (!fs.existsSync(sourcePath)) {
        results.push({
          mapping,
          success: false,
          error: '소스 파일 없음'
        });
        continue;
      }

      // 대상 디렉토리 생성
      await fs.ensureDir(path.dirname(destPath));

      // 기존 파일/링크 제거
      if (fs.existsSync(destPath)) {
        await fs.remove(destPath);
      }

      // symlink 생성
      await fs.symlink(sourcePath, destPath);

      results.push({
        mapping,
        success: true
      });
    } catch (error) {
      results.push({
        mapping,
        success: false,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * 워크트리의 symlink 상태 확인
 * @param {string} rootDir - 프로젝트 루트 경로
 * @param {string} worktreeName - 워크트리 폴더명
 * @param {string[]} symlinks - symlink 매핑 배열
 * @returns {Array<{mapping: string, linked: boolean, exists: boolean}>}
 */
function checkSymlinkStatus(rootDir, worktreeName, symlinks) {
  const worktreePath = path.join(rootDir, worktreeName);
  const results = [];

  for (const mapping of symlinks) {
    const { source, dest } = parseSymlinkMapping(mapping);
    const sourcePath = path.join(rootDir, source);
    const destPath = path.join(worktreePath, dest);

    const sourceExists = fs.existsSync(sourcePath);
    let linked = false;

    if (fs.existsSync(destPath)) {
      try {
        const stats = fs.lstatSync(destPath);
        if (stats.isSymbolicLink()) {
          const linkTarget = fs.readlinkSync(destPath);
          linked = linkTarget === sourcePath || path.resolve(path.dirname(destPath), linkTarget) === sourcePath;
        }
      } catch {
        linked = false;
      }
    }

    results.push({
      mapping,
      linked,
      exists: sourceExists
    });
  }

  return results;
}

module.exports = {
  parseSymlinkMapping,
  linkFilesToWorktree,
  checkSymlinkStatus
};
