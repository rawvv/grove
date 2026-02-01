const execa = require('execa');
const fs = require('fs');
const path = require('path');

/**
 * Git 설치 여부 확인
 * @returns {boolean}
 */
function isGitInstalled() {
  try {
    execa.sync('git', ['--version']);
    return true;
  } catch {
    return false;
  }
}

/**
 * Git URL 유효성 검사
 * @param {string} url
 * @returns {boolean}
 */
function isValidGitUrl(url) {
  if (!url || typeof url !== 'string') return false;

  const httpsPattern = /^https?:\/\/.+\/.+\.git$/;
  const sshPattern = /^git@.+:.+\.git$/;
  const simpleHttpsPattern = /^https?:\/\/.+\/.+$/;

  return httpsPattern.test(url) || sshPattern.test(url) || simpleHttpsPattern.test(url);
}

/**
 * .bare 디렉토리 존재 확인
 * @param {string} targetDir
 * @returns {boolean}
 */
function isBareRepoExists(targetDir = process.cwd()) {
  return fs.existsSync(path.join(targetDir, '.bare'));
}

/**
 * Git bare clone 실행
 * @param {string} url - Git 저장소 URL
 * @param {string} targetDir - 대상 디렉토리
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function cloneBareRepo(url, targetDir = process.cwd()) {
  const barePath = path.join(targetDir, '.bare');

  try {
    await execa('git', ['clone', '--bare', url, barePath]);

    // fetch 설정 추가
    try {
      await execa('git', ['config', 'remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*'], {
        cwd: barePath
      });
    } catch {
      // fetch 설정 실패는 무시
    }

    return { success: true };
  } catch (error) {
    const stderr = error.stderr || '';
    let errorMessage = '저장소 복제에 실패했어요.';

    if (stderr.includes('Authentication failed') ||
        stderr.includes('could not read Username') ||
        stderr.includes('Permission denied')) {
      errorMessage = '저장소에 접근할 수 없어요. 인증 정보를 확인해 주세요.';
    } else if (stderr.includes('Repository not found') ||
               stderr.includes('not found') ||
               stderr.includes('does not exist')) {
      errorMessage = '저장소를 찾을 수 없어요. URL을 다시 확인해 주세요.';
    } else if (stderr.includes('already exists')) {
      errorMessage = '이미 초기화된 프로젝트예요.';
    }

    return { success: false, error: errorMessage };
  }
}

/**
 * 원격 저장소 fetch
 * @param {string} bareDir - bare 저장소 경로
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function fetchOrigin(bareDir) {
  try {
    // fetch 설정 확인 및 추가
    const { stdout: fetchConfig } = await execa('git', ['-C', bareDir, 'config', 'remote.origin.fetch'], {
      reject: false
    });

    if (!fetchConfig) {
      await execa('git', ['-C', bareDir, 'config', 'remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*']);
    }

    await execa('git', ['-C', bareDir, 'fetch', 'origin', '--prune']);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Git 명령어 실행
 * @param {string[]} args - git 인자
 * @param {Object} options - execa 옵션
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
async function gitCommand(args, options = {}) {
  return execa('git', args, options);
}

module.exports = {
  isGitInstalled,
  isValidGitUrl,
  isBareRepoExists,
  cloneBareRepo,
  fetchOrigin,
  gitCommand
};
