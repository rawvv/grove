#!/usr/bin/env node

const { program } = require('commander');
const { init } = require('../src/commands/init');
const { main, runCommand } = require('../src/index');
const packageJson = require('../package.json');

program
  .name('git-grove')
  .description('Git bare repository 기반 워크트리 관리 CLI 도구')
  .version(packageJson.version);

// 기본 동작: 인터랙티브 메뉴
program
  .action(async () => {
    await main();
  });

// init: 저장소 초기화
program
  .command('init')
  .description('Git bare repository를 초기화')
  .action(init);

// create: 워크트리 생성
program
  .command('create')
  .description('새 워크트리 생성')
  .action(() => runCommand('create'));

// remove: 워크트리 삭제
program
  .command('remove')
  .description('워크트리 삭제')
  .action(() => runCommand('remove'));

// list: 목록 보기
program
  .command('list')
  .description('워크트리 목록 보기')
  .action(() => runCommand('list'));

// link: 파일 연결
program
  .command('link')
  .description('symlink로 파일 연결')
  .action(() => runCommand('link'));

// config: 설정 초기화
program
  .command('config')
  .description('설정 파일 초기화')
  .action(() => runCommand('config'));

// pr-review: PR 리뷰
program
  .command('pr-review')
  .description('PR 리뷰를 위한 워크트리 생성')
  .action(() => runCommand('pr-review'));

program.parse();
