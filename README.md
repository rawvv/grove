# bare REPOGITORY GUIDE

## 사용하는 이유

### 장점

- brach switch 비용을 줄이기 위해서,
- AI를 각각의 브런치에서 독립적으로 실행하여 능률을 올림

### 단점

- 오히려 복잡하다고 느낄 수 있음
- 매번 pnpm install env 연결이 귀찮을 수 있음.

## 기본 명령어

```
1. git clone --bare "주소" .bare

2. git -C .bare worktree add ../hotfix-folder dev
  - git add worktree ../$(폴더명) $(origin branch)

PR 이후
1. git branch -d $(branch)

2. git worktree remove $(worktree name)
```

## simboling link connection

```
path : root/
EXAMPLE : ln -sf $(pwd)/.env.backend ./hotfix-folder/backend/.env
EXAMPLE : ln -sf $(pwd)/.env.frontend ./hotfix-folder/frontend/.env
```

## worktree.sh 사용법

```
chmod +x worktree.sh
./worktree.sh
```

- 폴더명 작성 시 brach와 동일하면 보기 편함 단, / <- 이걸 폴더명에 포함하면 경로가 꼬일 수 있음

### ⚠️ 주의사항

- **절대 폴더를 rm -rf로 직접 삭제 금지** → worktree 메타데이터가 꼬임
- 꼬였을 때: `git -C .bare worktree prune` 으로 정리
- 삭제는 반드시 `git worktree remove` 또는 스크립트 3번 사용
- `.bare/worktrees/` 폴더를 직접 건드리지 말 것
