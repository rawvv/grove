# git-grove 🌳

Git bare repository 기반 워크트리 관리 CLI 도구

> ⚠️ **Beta**: 현재 0.1.0-beta 버전입니다.

## 소개

`git-grove`는 Git bare repository를 사용하여 여러 브랜치를 동시에 작업할 수 있게 해주는 CLI 도구입니다.

### 왜 bare repository인가요?

일반적인 Git 워크플로우에서는 브랜치를 전환할 때마다 `git checkout` 또는 `git switch`를 사용합니다. 하지만 이 방식은:

- 작업 중인 파일을 모두 stash하거나 commit해야 함
- node_modules 등 무거운 파일이 매번 재설치될 수 있음
- 여러 브랜치를 동시에 비교하기 어려움

bare repository + worktree 방식을 사용하면:

- 각 브랜치가 별도의 폴더로 존재
- 여러 브랜치를 동시에 열어서 작업 가능
- IDE에서 여러 브랜치 동시에 열기 가능

## 설치

```bash
# beta 버전 설치
npm install -g git-grove@beta
```

## 사용법

### 초기화

새 프로젝트 폴더에서 실행:

```bash
mkdir my-project && cd my-project
git-grove init
```

### 인터랙티브 모드

```bash
git-grove
```

```
  ╭───────────────────────────────────╮
  │  🌳 GIT GROVE      v0.1.0-beta    │
  ╰───────────────────────────────────╯

  ● 설정: .worktree.config
    base: main │ prefix: feat/

  ───────────────────────────────────────────

    1  📁  워크트리 생성
    2  🔗  파일 연결
    3  🗑️   워크트리 삭제
    4  📋  목록 보기
    5  ⚙️   설정 초기화
    6  🔍  PR 리뷰

    q  종료
```

### 서브커맨드

```bash
git-grove create      # 워크트리 생성
git-grove remove      # 워크트리 삭제
git-grove list        # 목록 보기
git-grove link        # 파일 연결 (symlink)
git-grove config      # 설정 초기화
git-grove pr-review   # PR 리뷰
```

## 주요 기능

| 기능 | 설명 |
|------|------|
| **워크트리 생성** | 새 브랜치 또는 기존 브랜치로 워크트리 생성 |
| **파일 연결** | .env 등 공통 파일 symlink 연결 |
| **워크트리 삭제** | 안전한 삭제 (보호 브랜치 자동 보호) |
| **PR 리뷰** | GitHub PR을 워크트리로 체크아웃 (`gh` CLI 필요) |

## 디렉토리 구조

```
my-project/
├── .bare/                 # Git bare repository
├── .worktree.config       # 설정 파일
├── .env                   # 공통 환경 변수
├── main/                  # main 브랜치 워크트리
├── feat-login/            # feature 브랜치 워크트리
└── pr-123/                # PR 리뷰용 워크트리
```

## 설정 파일

`.worktree.config`:

```bash
BARE_DIR=".bare"
DEFAULT_BASE_BRANCH="main"
DEFAULT_BRANCH_PREFIX="feat/"

SYMLINKS=(
  ".env:.env"
  ".env.local:backend/.env.local"
)
```

## 주의사항

- **절대 폴더를 rm -rf로 직접 삭제 금지** - worktree 메타데이터가 꼬임
- 꼬였을 때: `git -C .bare worktree prune`
- `.bare/worktrees/` 폴더를 직접 건드리지 말 것

## 요구사항

- Node.js >= 14.0.0
- Git >= 2.5.0
- GitHub CLI (`gh`) - PR 리뷰 기능 사용 시

## 라이선스

MIT
