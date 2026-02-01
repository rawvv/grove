const fs = require('fs');
const path = require('path');
const { PROTECTED_BRANCHES } = require('./constants');

/**
 * 폴더명 유효성 검사
 * @param {string} name - 폴더명
 * @returns {string|true} - 에러 메시지 또는 true
 */
function validateFolderName(name) {
  if (!name || name.trim() === '') {
    return '폴더명을 입력해 주세요.';
  }

  // 특수문자 검사
  const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
  if (invalidChars.test(name)) {
    return '폴더명에 사용할 수 없는 문자가 포함되어 있어요.';
  }

  // 예약어 검사
  const reserved = ['.', '..', '.bare', 'node_modules'];
  if (reserved.includes(name.toLowerCase())) {
    return '사용할 수 없는 폴더명이에요.';
  }

  return true;
}

/**
 * 브랜치명 유효성 검사
 * @param {string} name - 브랜치명
 * @returns {string|true} - 에러 메시지 또는 true
 */
function validateBranchName(name) {
  if (!name || name.trim() === '') {
    return '브랜치명을 입력해 주세요.';
  }

  // Git 브랜치명 규칙 검사
  const invalidPatterns = [
    /^-/, // 대시로 시작
    /\.\.$/, // 연속 점으로 끝남
    /\.lock$/, // .lock으로 끝남
    /[\s~^:?*\[\]\\]/, // 금지 문자
    /@\{/ // @{ 패턴
  ];

  for (const pattern of invalidPatterns) {
    if (pattern.test(name)) {
      return '올바르지 않은 브랜치명이에요.';
    }
  }

  return true;
}

/**
 * 폴더 존재 여부 확인
 * @param {string} folderPath - 확인할 경로
 * @returns {boolean}
 */
function folderExists(folderPath) {
  return fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory();
}

/**
 * 파일 존재 여부 확인
 * @param {string} filePath - 확인할 경로
 * @returns {boolean}
 */
function fileExists(filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

/**
 * 보호 브랜치 여부 확인
 * @param {string} branchName - 브랜치명
 * @returns {boolean}
 */
function isProtectedBranch(branchName) {
  return PROTECTED_BRANCHES.includes(branchName);
}

/**
 * Symlink 매핑 문자열 유효성 검사
 * @param {string} mapping - 소스:대상 형식의 문자열
 * @returns {string|true} - 에러 메시지 또는 true
 */
function validateSymlinkMapping(mapping) {
  if (!mapping || !mapping.includes(':')) {
    return '형식이 올바르지 않아요. (예: .env:.env)';
  }

  const [source, dest] = mapping.split(':');
  if (!source || !dest) {
    return '소스와 대상을 모두 입력해 주세요.';
  }

  return true;
}

module.exports = {
  validateFolderName,
  validateBranchName,
  folderExists,
  fileExists,
  isProtectedBranch,
  validateSymlinkMapping
};
