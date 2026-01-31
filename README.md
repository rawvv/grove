# bare REPOGITORY GUIDE

## 설치 방법 (택 1)
- Download
- git clone "https://github.com/ho8ae/repoName-bare.git" 
  - clone 받은 폴더 내부 .git 삭제 

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
chmod +x worktree-manager.sh
./worktree-manager.sh
```

- 폴더명 작성 시 brach와 동일하면 보기 편함 단, / <- 이걸 폴더명에 포함하면 경로가 꼬일 수 있음

### ⚠️ 주의사항

- **절대 폴더를 rm -rf로 직접 삭제 금지** → worktree 메타데이터가 꼬임
- 꼬였을 때: `git -C .bare worktree prune` 으로 정리
- 삭제는 반드시 `git worktree remove` 또는 스크립트 3번 사용
- `.bare/worktrees/` 폴더를 직접 건드리지 말 것
