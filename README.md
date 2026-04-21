# @rawvv/grove 🌳

Git bare repository 기반 워크트리 관리 CLI 도구

> ⚠️ **Beta**: 현재 beta 버전입니다.

## 소개

`grove`는 Git bare repository를 사용하여 여러 브랜치를 동시에 작업할 수 있게 해주는 CLI 도구입니다.

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
npm install -g @rawvv/grove@beta
```

## 사용법

### 초기화

새 프로젝트 폴더에서 실행:

```bash
mkdir my-project && cd my-project
grove init
```

### 인터랙티브 모드

```bash
grove
```

```
  ╭─────────────────────────────╮
  │  🌳 GROVE      v0.1.2-beta  │
  ╰─────────────────────────────╯

  ● active  feat/my-feature [clean]
  ◎ base    main  │  prefix  feat/

  ───────────────────────────────────────────

    1  📁  워크트리 생성
    2  🔗  파일 복사
    3  🗑️   워크트리 삭제
    4  📋  목록 보기
    5  ⚙️   설정 초기화
    6  🔍  PR 리뷰

  ───────────────────────────────────────────
  ?  도움말   q  종료
```

### 서브커맨드

```bash
grove create      # 워크트리 생성
grove remove      # 워크트리 삭제
grove list        # 목록 보기 (active 마커 + clean/dirty 상태)
grove link        # 파일 복사 (FILES 설정 기반)
grove config      # 설정 초기화
grove pr-review   # PR 리뷰
grove help        # 커맨드 목록 및 설정 가이드
```

## 주요 기능

| 기능 | 설명 |
|------|------|
| **워크트리 생성** | 새 브랜치 또는 기존 브랜치로 워크트리 생성 |
| **파일 복사** | `.env` 등 공통 파일을 워크트리에 복사 (docker bind mount 호환) |
| **훅 시스템** | 워크트리 생성 전후 커스텀 명령 자동 실행 (docker-compose 등) |
| **active 추적** | 현재 작업 중인 워크트리를 메뉴에서 바로 확인 |
| **워크트리 삭제** | 안전한 삭제 (보호 브랜치 자동 보호) |
| **PR 리뷰** | GitHub PR을 워크트리로 체크아웃 (`gh` CLI 필요) |
| **새 버전 알림** | 업데이트 출시 시 메뉴에서 알림 표시 |

## 디렉토리 구조

```
my-project/
├── .bare/                 # Git bare repository
├── .worktree.config       # 설정 파일
├── .env                   # 공통 환경 변수 (복사 원본)
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

# 워크트리 생성 시 복사할 파일 (소스:대상)
FILES=(
  ".env:.env"
  ".env.local:backend/.env.local"
)

# 새 워크트리 생성 전 실행 (기존 환경 정리)
PRE_SWITCH_COMMANDS=(
  "docker-compose down"
)

# 새 워크트리 생성 후 실행 (새 환경 시작)
POST_CREATE_COMMANDS=(
  "docker-compose up -d"
)
```

> `POST_CREATE_COMMANDS` 실행 시 `COMPOSE_PROJECT_NAME`이 워크트리 폴더명으로 자동 설정됩니다. 여러 워크트리를 동시에 띄워도 컨테이너 이름이 충돌하지 않습니다.

> 기존 `SYMLINKS` 키는 `FILES`로 변경되었습니다. 하위 호환을 위해 `SYMLINKS`도 계속 읽힙니다.

## 주의사항

- **절대 폴더를 rm -rf로 직접 삭제 금지** — worktree 메타데이터가 꼬임
- 꼬였을 때: `git -C .bare worktree prune`
- `.bare/worktrees/` 폴더를 직접 건드리지 말 것

## 요구사항

- Node.js >= 14.0.0
- Git >= 2.5.0
- GitHub CLI (`gh`) — PR 리뷰 기능 사용 시
