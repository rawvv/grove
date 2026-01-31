#!/bin/bash

# ============================================
# WORKTREE MANAGER
# ============================================
# Version:     0.0.5
# Author:      raw
# Repository:  -
# License:     MIT
# 
# Description:
#   Git bare repository 기반 워크트리 관리 도구
#   - 워크트리 생성/삭제
#   - 환경 파일 symlink 자동 연결
#   - 브랜치 분기 및 최신화 자동 처리
#
# Usage:
#   chmod +x worktree-manager.sh
#   ./worktree-manager.sh
#
# Config:
#   프로젝트 루트에 .worktree.config 파일 생성
#   (5번 메뉴에서 대화형으로 생성 가능)
# ============================================

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_FILE="$ROOT_DIR/.worktree.config"

# 기본 설정
BARE_DIR=".bare"
SYMLINKS=()
DEFAULT_BASE_BRANCH="main"
DEFAULT_BRANCH_PREFIX="feat/"

# 설정 파일 로드
[ -f "$CONFIG_FILE" ] && source "$CONFIG_FILE"

# 색상 & 스타일
R='\033[0;31m'
G='\033[0;32m'
Y='\033[1;33m'
B='\033[0;34m'
C='\033[0;36m'
M='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# 아이콘
ICO_FOLDER="📁"
ICO_BRANCH="🌿"
ICO_LINK="🔗"
ICO_TRASH="🗑️"
ICO_LIST="📋"
ICO_GEAR="⚙️"
ICO_CHECK="✓"
ICO_CROSS="✗"
ICO_ARROW="→"
ICO_WARN="⚠"
ICO_REVIEW="🔍"

# 스피너 애니메이션
spinner() {
  local pid=$1
  local msg="${2:-로딩 중...}"
  local frames=("⠋" "⠙" "⠹" "⠸" "⠼" "⠴" "⠦" "⠧" "⠇" "⠏")
  local i=0
  
  tput civis  # 커서 숨기기
  while kill -0 "$pid" 2>/dev/null; do
    printf "\r  ${C}${frames[$i]}${NC} ${DIM}%s${NC}" "$msg"
    i=$(( (i + 1) % ${#frames[@]} ))
    sleep 0.08
  done
  printf "\r%*s\r" $((${#msg} + 10)) ""  # 클리어
  tput cnorm  # 커서 복원
}

# 프로그레스 바
progress_bar() {
  local current=$1
  local total=$2
  local width=30
  local pct=$((current * 100 / total))
  local filled=$((current * width / total))
  local empty=$((width - filled))
  
  printf "\r  ${DIM}[${NC}"
  printf "${G}%*s${NC}" $filled | tr ' ' '█'
  printf "${DIM}%*s${NC}" $empty | tr ' ' '░'
  printf "${DIM}]${NC} ${BOLD}%3d%%${NC}" $pct
}

# 박스 그리기
box() {
  local title="$1"
  local width=40
  echo ""
  echo -e "  ${C}╭$( printf '─%.0s' $(seq 1 $width) )╮${NC}"
  printf "  ${C}│${NC} ${BOLD}%-*s${NC} ${C}│${NC}\n" $((width - 1)) "$title"
  echo -e "  ${C}╰$( printf '─%.0s' $(seq 1 $width) )╯${NC}"
}

# 섹션 헤더
section() {
  echo ""
  echo -e "  ${BOLD}${C}▸${NC} ${BOLD}$1${NC}"
  echo -e "  ${DIM}$(printf '─%.0s' $(seq 1 38))${NC}"
}

# 성공/실패 메시지
msg_ok() { echo -e "  ${G}${ICO_CHECK}${NC} $1"; }
msg_err() { echo -e "  ${R}${ICO_CROSS}${NC} $1"; }
msg_warn() { echo -e "  ${Y}${ICO_WARN}${NC} $1"; }
msg_info() { echo -e "  ${C}ℹ${NC} ${DIM}$1${NC}"; }

# 입력 프롬프트
prompt() {
  echo -ne "  ${M}▸${NC} $1"
  read -r REPLY
  if [ "$REPLY" = "z" ] || [ "$REPLY" = "Z" ]; then
    return 1
  fi
  return 0
}

# bare repo 확인
check_bare_repo() {
  if [ ! -d "$ROOT_DIR/$BARE_DIR" ]; then
    msg_err "'$BARE_DIR' 폴더가 없습니다"
    msg_info "bare clone을 먼저 생성하세요:"
    echo -e "    ${DIM}git clone --bare <repo-url> $BARE_DIR${NC}"
    echo ""
    read -p "  Enter를 눌러 계속..."
    return 1
  fi

  # fetch 설정 확인 및 자동 추가
  local fetch_config=$(git -C "$ROOT_DIR/$BARE_DIR" config remote.origin.fetch 2>/dev/null)
  if [ -z "$fetch_config" ]; then
    msg_info "fetch 설정 추가 중..."
    git -C "$ROOT_DIR/$BARE_DIR" config remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*"
  fi

  # 원격 저장소 최신화 (스피너)
  git -C "$ROOT_DIR/$BARE_DIR" fetch origin --prune &>/dev/null &
  spinner $! "원격 저장소 동기화 중..."
  msg_ok "동기화 완료"
  return 0
}

# 워크트리 목록 가져오기
get_worktrees() {
  git -C "$ROOT_DIR/$BARE_DIR" worktree list | grep -v "(bare)" | awk '{print $1}' | xargs -I {} basename {}
}

# 브랜치 목록 가져오기
get_branches() {
  git -C "$ROOT_DIR/$BARE_DIR" branch -a | sed 's/^[* ]*//' | sed 's/remotes\/origin\///' | grep -v "HEAD" | sort -u
}

# 1. 워크트리 생성
create_worktree() {
  check_bare_repo || return
  
  box "${ICO_FOLDER} 워크트리 생성"
  
  # 현재 워크트리 목록
  section "현재 워크트리"
  local wt_list=$(git -C "$ROOT_DIR/$BARE_DIR" worktree list)
  echo "$wt_list" | while read -r line; do
    echo -e "    ${DIM}$line${NC}"
  done
  
  # 폴더명 입력
  echo ""
  prompt "폴더명 입력 ${DIM}(취소: Enter, 이전: z)${NC}: " || return
  local folder="$REPLY"
  
  if [ -z "$folder" ]; then
    msg_warn "취소됨"
    return
  fi
  
  if [ -d "$ROOT_DIR/$folder" ]; then
    msg_err "'$folder' 폴더가 이미 존재합니다"
    return
  fi
  
  # 브랜치 선택
  section "브랜치 선택"
  branches=($(get_branches))
  for i in "${!branches[@]}"; do
    printf "    ${DIM}%2d.${NC} %s\n" $((i+1)) "${branches[$i]}"
  done
  echo -e "    ${C} n.${NC} ${C}새 브랜치 생성${NC}"
  echo ""
  prompt "브랜치 번호/이름 ${DIM}(n: 새 브랜치, z: 이전)${NC}: " || return
  local branch_input="$REPLY"
  
  if [ "$branch_input" = "n" ] || [ "$branch_input" = "N" ]; then
    box "${ICO_BRANCH} 새 브랜치 생성"
    
    # 1. 기반 브랜치 선택
    section "[1/2] 분기 브랜치 선택"
    for i in "${!branches[@]}"; do
      local marker=""
      if [ "${branches[$i]}" = "$DEFAULT_BASE_BRANCH" ]; then
        marker=" ${G}← 기본${NC}"
      fi
      printf "    ${DIM}%2d.${NC} %s%b\n" $((i+1)) "${branches[$i]}" "$marker"
    done
    echo ""
    prompt "기반 브랜치 ${DIM}(Enter: $DEFAULT_BASE_BRANCH, z: 이전)${NC}: " || return
    local base_input="$REPLY"
    
    if [ -z "$base_input" ]; then
      base_branch="$DEFAULT_BASE_BRANCH"
    elif [[ "$base_input" =~ ^[0-9]+$ ]] && [ "$base_input" -le "${#branches[@]}" ]; then
      base_branch="${branches[$((base_input-1))]}"
    else
      base_branch="$base_input"
    fi
    
    # 2. 새 브랜치 이름
    section "[2/2] 새 브랜치 이름"
    local suggested_branch="${DEFAULT_BRANCH_PREFIX}${folder}"
    msg_info "제안: ${C}$suggested_branch${NC}"
    msg_info "예시: feat/login, fix/bug-123, issue/576"
    echo ""
    prompt "브랜치 이름 ${DIM}(Enter: 제안 사용, z: 이전)${NC}: " || return
    local new_branch="$REPLY"
    
    [ -z "$new_branch" ] && new_branch="$suggested_branch"
    
    # 확인
    box "생성 정보 확인"
    echo -e "    ${ICO_FOLDER} 폴더:   ${BOLD}$folder${NC}"
    echo -e "    ${ICO_BRANCH} 브랜치: ${BOLD}$new_branch${NC}"
    echo -e "    ${ICO_ARROW} 분기:   ${DIM}$base_branch${NC} ${ICO_ARROW} ${C}$new_branch${NC}"
    echo ""
    prompt "진행할까요? ${DIM}(Y/n, z: 이전)${NC}: " || return
    
    if [ "$REPLY" = "n" ] || [ "$REPLY" = "N" ]; then
      msg_warn "취소됨"
      return
    fi
    
    # 생성 (스피너)
    echo ""
    git -C "$ROOT_DIR/$BARE_DIR" worktree add -b "$new_branch" "../$folder" "origin/$base_branch" &>/dev/null &
    spinner $! "워크트리 생성 중..."
    
    # upstream 해제 (실수로 base 브랜치에 push 방지)
    if [ -d "$ROOT_DIR/$folder" ]; then
      git -C "$ROOT_DIR/$folder" branch --unset-upstream &>/dev/null
    fi
    
    if [ $? -eq 0 ] && [ -d "$ROOT_DIR/$folder" ]; then
      msg_ok "워크트리 생성 완료: ${BOLD}$folder${NC} (${C}$new_branch${NC})"
      branch="$new_branch"
    else
      msg_err "워크트리 생성 실패"
      msg_info "브랜치명에 특수문자가 있으면 문제가 될 수 있습니다"
      return
    fi
  else
    # 기존 브랜치
    if [[ "$branch_input" =~ ^[0-9]+$ ]] && [ "$branch_input" -le "${#branches[@]}" ]; then
      branch="${branches[$((branch_input-1))]}"
    else
      branch="$branch_input"
    fi
    
    if [ -z "$branch" ]; then
      msg_warn "취소됨"
      return
    fi
    
    # 생성 (스피너)
    echo ""
    (git -C "$ROOT_DIR/$BARE_DIR" worktree add -b "$branch" "../$folder" "origin/$branch" 2>/dev/null \
      || git -C "$ROOT_DIR/$BARE_DIR" worktree add "../$folder" "$branch") &
    spinner $! "워크트리 생성 중..."
    
    if [ -d "$ROOT_DIR/$folder" ]; then
      msg_ok "워크트리 생성 완료: ${BOLD}$folder${NC} (${C}$branch${NC})"
    else
      msg_err "워크트리 생성 실패"
      return
    fi
  fi
  
  # symlink 제안
  if [ ${#SYMLINKS[@]} -gt 0 ]; then
    echo ""
    prompt "설정된 파일들도 연결할까요? ${DIM}(Y/n, z: 이전)${NC}: " || return
    if [ "$REPLY" != "n" ] && [ "$REPLY" != "N" ]; then
      link_files "$folder"
    fi
  fi
}

# 2. 파일 연결 (symlink)
link_files() {
  local folder="$1"
  
  if [ -z "$folder" ]; then
    check_bare_repo || return
    
    box "${ICO_LINK} 파일 연결 (Symlink)"
    
    if [ ${#SYMLINKS[@]} -eq 0 ]; then
      msg_warn "설정된 symlink가 없습니다"
      msg_info ".worktree.config 파일을 생성하세요"
      return
    fi
    
    worktrees=($(get_worktrees))
    if [ ${#worktrees[@]} -eq 0 ]; then
      msg_err "워크트리가 없습니다"
      return
    fi
    
    section "워크트리 선택"
    for i in "${!worktrees[@]}"; do
      printf "    ${DIM}%2d.${NC} %s\n" $((i+1)) "${worktrees[$i]}"
    done
    echo ""
    prompt "번호 입력 ${DIM}(z: 이전)${NC}: " || return
    local idx="$REPLY"

    if ! [[ "$idx" =~ ^[0-9]+$ ]] || [ "$idx" -lt 1 ] || [ "$idx" -gt "${#worktrees[@]}" ]; then
      msg_warn "취소됨"
      return
    fi
    folder="${worktrees[$((idx-1))]}"
  fi

  local worktree_path="$ROOT_DIR/$folder"
  
  if [ ! -d "$worktree_path" ]; then
    msg_err "$folder 폴더가 없습니다"
    return
  fi

  if [ ${#SYMLINKS[@]} -eq 0 ]; then
    msg_warn "설정된 symlink가 없습니다"
    return
  fi

  section "Symlink 연결"
  local total=${#SYMLINKS[@]}
  local current=0
  
  for mapping in "${SYMLINKS[@]}"; do
    current=$((current + 1))
    local src="${mapping%%:*}"
    local dest="${mapping#*:}"
    local src_path="$ROOT_DIR/$src"
    local dest_path="$worktree_path/$dest"
    
    progress_bar $current $total
    sleep 0.1
    
    if [ -f "$src_path" ]; then
      mkdir -p "$(dirname "$dest_path")"
      ln -sf "$src_path" "$dest_path"
    fi
  done
  echo ""
  
  # 결과 출력
  for mapping in "${SYMLINKS[@]}"; do
    local src="${mapping%%:*}"
    local dest="${mapping#*:}"
    local src_path="$ROOT_DIR/$src"
    
    if [ -f "$src_path" ]; then
      echo -e "    ${G}${ICO_CHECK}${NC} $src ${ICO_ARROW} $folder/$dest"
    else
      echo -e "    ${R}${ICO_CROSS}${NC} $src ${DIM}(파일 없음)${NC}"
    fi
  done
  echo ""
  msg_ok "연결 완료"
}

# 3. 워크트리 삭제
remove_worktree() {
  check_bare_repo || return
  
  box "${ICO_TRASH} 워크트리 삭제"
  
  worktrees=($(get_worktrees))
  if [ ${#worktrees[@]} -eq 0 ]; then
    msg_err "삭제할 워크트리가 없습니다"
    return
  fi
  
  section "워크트리 선택"
  for i in "${!worktrees[@]}"; do
    local wt_path="$ROOT_DIR/${worktrees[$i]}"
    local branch=$(git -C "$wt_path" branch --show-current 2>/dev/null)
    printf "    ${DIM}%2d.${NC} %s ${C}(%s)${NC}\n" $((i+1)) "${worktrees[$i]}" "$branch"
  done
  echo ""
  prompt "번호 입력 ${DIM}(z: 이전)${NC}: " || return
  local idx="$REPLY"
  
  if ! [[ "$idx" =~ ^[0-9]+$ ]] || [ "$idx" -lt 1 ] || [ "$idx" -gt "${#worktrees[@]}" ]; then
    msg_warn "취소됨"
    return
  fi
  
  local folder="${worktrees[$((idx-1))]}"
  local wt_path="$ROOT_DIR/$folder"
  local branch=$(git -C "$wt_path" branch --show-current 2>/dev/null)
  
  echo ""
  echo -e "  ${R}${BOLD}정말 삭제할까요?${NC}"
  echo -e "    ${ICO_FOLDER} $folder"
  echo -e "    ${ICO_BRANCH} $branch"
  echo ""
  prompt "${R}삭제 진행? (y/N, z: 이전)${NC}: " || return

  if [ "$REPLY" != "y" ]; then
    msg_warn "취소됨"
    return
  fi
  
  # 삭제 (스피너)
  echo ""
  git -C "$ROOT_DIR/$BARE_DIR" worktree remove "../$folder" --force &>/dev/null &
  spinner $! "워크트리 삭제 중..."
  
  if [ ! -d "$wt_path" ]; then
    msg_ok "워크트리 삭제 완료"
    
    # 보호 브랜치 확인
    local protected_branches=("main" "master" "dev" "develop" "staging" "production")
    local is_protected=false
    for pb in "${protected_branches[@]}"; do
      [ "$branch" = "$pb" ] && is_protected=true && break
    done
    
    # 브랜치 삭제 여부
    if [ -n "$branch" ] && [ "$is_protected" = false ]; then
      echo ""
      prompt "브랜치 '$branch'도 삭제? ${DIM}(y/N, z: 이전)${NC}: " || return
      if [ "$REPLY" = "y" ]; then
        git -C "$ROOT_DIR/$BARE_DIR" branch -D "$branch" &>/dev/null
        msg_ok "브랜치 삭제 완료"
      fi
    fi
  else
    msg_err "삭제 실패"
  fi
}

# 4. 목록 보기
show_list() {
  check_bare_repo || return
  
  box "${ICO_LIST} 워크트리 목록"
  
  section "워크트리"
  git -C "$ROOT_DIR/$BARE_DIR" worktree list | while read -r line; do
    echo -e "    ${DIM}$line${NC}"
  done
  
  if [ ${#SYMLINKS[@]} -gt 0 ]; then
    section "Symlink 설정"
    for mapping in "${SYMLINKS[@]}"; do
      local src="${mapping%%:*}"
      local dest="${mapping#*:}"
      echo -e "    $src ${ICO_ARROW} $dest"
    done
  fi
}

# 5. 설정 초기화
init_config() {
  box "${ICO_GEAR} 설정 초기화"
  
  if [ -f "$CONFIG_FILE" ]; then
    msg_warn "이미 .worktree.config 파일이 존재합니다"
    prompt "덮어쓸까요? ${DIM}(y/N, z: 이전)${NC}: " || return
    if [ "$REPLY" != "y" ]; then
      msg_warn "취소됨"
      return
    fi
  fi
  
  section "기본 설정"

  prompt "Bare repo 디렉토리 ${DIM}(기본: .bare, z: 이전)${NC}: " || return
  local bare_dir="${REPLY:-.bare}"

  prompt "기본 base 브랜치 ${DIM}(기본: main, z: 이전)${NC}: " || return
  local default_base="${REPLY:-main}"

  msg_info "브랜치 prefix 예시: feat/, fix/, feature/, hotfix/"
  prompt "기본 브랜치 prefix ${DIM}(기본: feat/, z: 이전)${NC}: " || return
  local default_prefix="${REPLY:-feat/}"

  section "Symlink 설정"
  msg_info "env 파일이 들어갈 폴더를 지정하세요"
  msg_info "예: backend, frontend, apps/web 등"
  prompt "env 대상 폴더 ${DIM}(Enter: 루트, z: 이전)${NC}: " || return
  local env_folder="${REPLY:-.}"

  local symlinks_config=""
  # 기본 .env symlink 자동 추가
  if [ "$env_folder" = "." ]; then
    symlinks_config+="  \".env:.env\"\n"
    msg_ok ".env → .env 추가됨"
  else
    symlinks_config+="  \".env:${env_folder}/.env\"\n"
    msg_ok ".env → ${env_folder}/.env 추가됨"
  fi

  echo ""
  msg_info "추가 symlink가 필요하면 입력하세요"
  msg_info "형식: 소스파일:대상경로 (예: .env.local:backend/.env.local)"
  msg_info "빈 줄 입력시 종료"
  echo ""

  while true; do
    prompt "symlink 추가 ${DIM}(빈 줄: 종료, z: 이전)${NC}: " || return
    [ -z "$REPLY" ] && break
    if [[ "$REPLY" == *":"* ]]; then
      symlinks_config+="  \"$REPLY\"\n"
      msg_ok "추가됨"
    else
      msg_err "형식 오류. '소스:대상' 형식으로 입력하세요"
    fi
  done
  
  # 설정 파일 생성
  cat > "$CONFIG_FILE" << EOF
# Worktree Manager 설정 파일

BARE_DIR="$bare_dir"
DEFAULT_BASE_BRANCH="$default_base"
DEFAULT_BRANCH_PREFIX="$default_prefix"

SYMLINKS=(
$(echo -e "$symlinks_config"))
EOF
  
  echo ""
  msg_ok ".worktree.config 생성 완료"
  
  section "생성된 설정"
  cat "$CONFIG_FILE" | while read -r line; do
    echo -e "    ${DIM}$line${NC}"
  done
  
  source "$CONFIG_FILE"
}

# 6. PR 리뷰 - 상태별 PR 목록 표시 및 워크트리 생성
pr_list_by_state() {
  local state="$1"  # open 또는 closed
  local state_label="$2"

  section "${state_label} PR 목록"

  # PR 목록 조회
  local pr_list=$(gh pr list --state "$state" --limit 20 --json number,title,headRefName,author \
    --template '{{range .}}{{.number}}'$'\t''{{.title}}'$'\t''{{.headRefName}}'$'\t''{{.author.login}}{{"\n"}}{{end}}')

  if [ -z "$pr_list" ]; then
    msg_warn "${state_label} PR이 없습니다"
    return
  fi

  # PR 목록 표시 (번호순)
  local i=1
  while IFS=$'\t' read -r num title branch author; do
    printf "    ${DIM}%2d.${NC} ${C}#%s${NC} %s ${DIM}(%s)${NC}\n" "$i" "$num" "$title" "$author"
    i=$((i+1))
  done <<< "$pr_list"

  echo ""
  prompt "몇 번 PR로 가시겠습니까? ${DIM}(취소: Enter, z: 이전)${NC}: " || return
  local selection="$REPLY"

  [ -z "$selection" ] && { msg_warn "취소됨"; return; }

  # 선택한 PR 정보 추출
  local selected_line=$(echo "$pr_list" | sed -n "${selection}p")
  local pr_number=$(echo "$selected_line" | cut -f1)
  local pr_branch=$(echo "$selected_line" | cut -f3)

  if [ -z "$pr_number" ]; then
    msg_err "잘못된 선택입니다"
    return
  fi

  # PR 상세 정보 표시
  section "PR #$pr_number 상세"
  gh pr view "$pr_number"

  echo ""
  prompt "이 PR로 워크트리를 생성하시겠습니까? ${DIM}(Y/n, z: 이전)${NC}: " || return

  if [ "$REPLY" = "n" ] || [ "$REPLY" = "N" ]; then
    msg_warn "취소됨"
    return
  fi

  # 워크트리 생성
  local folder="pr-$pr_number"

  if [ -d "$ROOT_DIR/$folder" ]; then
    msg_err "'$folder' 폴더가 이미 존재합니다"
    return
  fi

  echo ""
  git -C "$ROOT_DIR/$BARE_DIR" fetch origin "pull/$pr_number/head:pr-$pr_number" &>/dev/null &
  spinner $! "PR 브랜치 fetch 중..."

  git -C "$ROOT_DIR/$BARE_DIR" worktree add "../$folder" "pr-$pr_number" &>/dev/null &
  spinner $! "워크트리 생성 중..."

  if [ -d "$ROOT_DIR/$folder" ]; then
    msg_ok "워크트리 생성 완료: ${BOLD}$folder${NC}"

    # symlink 연결 제안
    if [ ${#SYMLINKS[@]} -gt 0 ]; then
      echo ""
      prompt "설정된 파일들도 연결할까요? ${DIM}(Y/n, z: 이전)${NC}: " || return
      if [ "$REPLY" != "n" ] && [ "$REPLY" != "N" ]; then
        link_files "$folder"
      fi
    fi
  else
    msg_err "워크트리 생성 실패"
  fi
}

# PR 리뷰 서브메뉴 - open/closed 선택
pr_review_submenu() {
  while true; do
    box "${ICO_REVIEW} PR 리뷰"

    echo ""
    echo -e "    ${BOLD}1${NC}  ${G}●${NC} Open PR"
    echo -e "    ${BOLD}2${NC}  ${R}●${NC} Closed PR"
    echo ""
    echo -e "    ${DIM}z${NC}  ${DIM}이전 메뉴${NC}"
    echo ""

    prompt "선택: " || return

    case "$REPLY" in
      1)
        pr_list_by_state "open" "Open"
        echo ""
        read -p "  Enter를 눌러 계속..."
        ;;
      2)
        pr_list_by_state "closed" "Closed"
        echo ""
        read -p "  Enter를 눌러 계속..."
        ;;
      *)
        msg_warn "잘못된 선택"
        ;;
    esac
  done
}

# 6. PR 리뷰 메인
pr_review() {
  # gh CLI 확인
  if ! command -v gh &>/dev/null; then
    msg_err "gh CLI가 설치되어 있지 않습니다"
    msg_info "설치: brew install gh"
    return
  fi

  check_bare_repo || return

  pr_review_submenu
}

# 메인 메뉴
main_menu() {
  clear
  
  # 헤더
  echo ""
  echo -e "  ${BOLD}${C}╭─────────────────────────────────────────╮${NC}"
  echo -e "  ${BOLD}${C}│${NC}  ${BOLD}🌳 WORKTREE MANAGER${NC}      ${DIM}v0.0.5 - raw${NC}  ${BOLD}${C}│${NC}"
  echo -e "  ${BOLD}${C}╰─────────────────────────────────────────╯${NC}"
  
  # 설정 상태
  echo ""
  if [ -f "$CONFIG_FILE" ]; then
    echo -e "  ${G}●${NC} ${DIM}설정:${NC} .worktree.config"
    echo -e "    ${DIM}base:${NC} ${C}$DEFAULT_BASE_BRANCH${NC} ${DIM}│ prefix:${NC} ${C}$DEFAULT_BRANCH_PREFIX${NC}"
  else
    echo -e "  ${Y}○${NC} ${DIM}설정: 기본값 사용${NC}"
  fi
  
  # 메뉴
  echo ""
  echo -e "  ${DIM}───────────────────────────────────────────${NC}"
  echo ""
  echo -e "    ${BOLD}1${NC}  ${ICO_FOLDER}  워크트리 생성"
  echo -e "    ${BOLD}2${NC}  ${ICO_LINK}  파일 연결"
  echo -e "    ${BOLD}3${NC}  ${ICO_TRASH}  워크트리 삭제"
  echo -e "    ${BOLD}4${NC}  ${ICO_LIST}  목록 보기"
  echo -e "    ${BOLD}5${NC}  ${ICO_GEAR}  설정 초기화"
  echo -e "    ${BOLD}6${NC}  ${ICO_REVIEW}  PR 리뷰"
  echo ""
  echo -e "    ${DIM}q${NC}  ${DIM}종료${NC}"
  echo ""
  echo -e "  ${DIM}───────────────────────────────────────────${NC}"
  echo -e "  ${DIM}💡 하위 메뉴에서 'z' 입력 시 이전 메뉴로${NC}"
  echo ""
  prompt "선택: "
  
  case "$REPLY" in
    1) create_worktree ;;
    2) link_files ;;
    3) remove_worktree ;;
    4) show_list ;;
    5) init_config ;;
    6) pr_review ;;
    q|Q) echo -e "\n  👋 ${DIM}Bye!${NC}\n"; exit 0 ;;
    *) msg_err "잘못된 선택" ;;
  esac
  
  echo ""
  read -p "  Enter를 눌러 계속..."
  main_menu
}

# 실행
main_menu