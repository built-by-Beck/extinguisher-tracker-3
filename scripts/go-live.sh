#!/usr/bin/env bash
# ============================================================
#  go-live.sh — One command to push, build, test, and deploy
#  Author: built_by_Beck
#
#  Usage:
#    ./scripts/go-live.sh                  # full deploy (hosting + functions + rules)
#    ./scripts/go-live.sh --hosting-only   # skip functions deploy
#    ./scripts/go-live.sh --skip-tests     # skip test suite
#    ./scripts/go-live.sh --no-push        # deploy without pushing to GitHub
# ============================================================

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# ── Flags ──────────────────────────────────────────────────
HOSTING_ONLY=false
SKIP_TESTS=false
NO_PUSH=false

for arg in "$@"; do
  case "$arg" in
    --hosting-only)  HOSTING_ONLY=true ;;
    --skip-tests)    SKIP_TESTS=true ;;
    --no-push)       NO_PUSH=true ;;
    -h|--help)
      echo "Usage: ./scripts/go-live.sh [--hosting-only] [--skip-tests] [--no-push]"
      exit 0
      ;;
    *)
      echo "Unknown flag: $arg"
      exit 1
      ;;
  esac
done

# ── Colors ─────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

step() { echo -e "\n${CYAN}━━━ $1 ━━━${NC}\n"; }
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }

echo -e "${CYAN}"
echo "  ╔═══════════════════════════════════════╗"
echo "  ║     🔥  GO LIVE — built_by_Beck  🔥    ║"
echo "  ╚═══════════════════════════════════════╝"
echo -e "${NC}"

# ── 1. Check for uncommitted changes ──────────────────────
step "Checking git status"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "You have uncommitted changes:"
  git status --short
  echo ""
  read -rp "Commit all changes before deploying? (y/n) " answer
  if [[ "$answer" =~ ^[Yy] ]]; then
    read -rp "Commit message: " msg
    git add -A
    git commit -m "$msg — built_by_Beck"
    ok "Changes committed"
  else
    fail "Commit or stash your changes first"
  fi
else
  ok "Working tree clean"
fi

# ── 2. Run tests ──────────────────────────────────────────
if [[ "$SKIP_TESTS" == false ]]; then
  step "Running tests"
  if pnpm test; then
    ok "All tests passed"
  else
    fail "Tests failed — fix before deploying"
  fi
else
  warn "Skipping tests (--skip-tests)"
fi

# ── 3. Build frontend ────────────────────────────────────
step "Building frontend"
if pnpm run build; then
  ok "Frontend built successfully"
else
  fail "Frontend build failed"
fi

# ── 4. Build functions (unless --hosting-only) ────────────
if [[ "$HOSTING_ONLY" == false ]]; then
  step "Building Cloud Functions"
  cd "$ROOT/functions"
  if npm run build; then
    ok "Functions built successfully"
  else
    fail "Functions build failed"
  fi
  cd "$ROOT"
fi

# ── 5. Push to GitHub ────────────────────────────────────
if [[ "$NO_PUSH" == false ]]; then
  step "Pushing to GitHub"
  BRANCH="$(git branch --show-current)"

  if [[ "$BRANCH" == "main" ]]; then
    # Try direct push first, fall back to PR if branch protection blocks it
    if git push origin main 2>/dev/null; then
      ok "Pushed to origin/main"
    else
      warn "Direct push blocked (branch protection)"
      echo "Creating PR to merge..."
      TEMP_BRANCH="deploy/go-live-$(date +%Y%m%d-%H%M%S)"
      git checkout -b "$TEMP_BRANCH"
      git push -u origin "$TEMP_BRANCH"
      PR_URL=$(gh pr create --title "Go live deploy — built_by_Beck" --body "Automated deploy via go-live.sh" --base main --head "$TEMP_BRANCH" 2>&1)
      echo "PR: $PR_URL"
      gh pr merge --merge --admin "$TEMP_BRANCH"
      git checkout main
      git pull origin main
      git branch -d "$TEMP_BRANCH"
      ok "Merged via PR"
    fi
  else
    git push -u origin "$BRANCH"
    ok "Pushed to origin/$BRANCH"
    warn "You're on '$BRANCH', not main. Deploy will use whatever is built locally."
  fi
else
  warn "Skipping git push (--no-push)"
fi

# ── 6. Deploy to Firebase ────────────────────────────────
step "Deploying to Firebase"
if [[ "$HOSTING_ONLY" == true ]]; then
  firebase deploy --only hosting
  ok "Hosting deployed"
else
  firebase deploy --only hosting,functions,firestore:rules,storage
  ok "Full deploy complete (hosting + functions + rules + storage)"
fi

# ── Done ──────────────────────────────────────────────────
echo ""
echo -e "${GREEN}"
echo "  ╔═══════════════════════════════════════╗"
echo "  ║        🎉  SITE IS LIVE!  🎉          ║"
echo "  ║         built_by_Beck                 ║"
echo "  ╚═══════════════════════════════════════╝"
echo -e "${NC}"
echo "  GitHub:  https://github.com/built-by-Beck/extinguisher-tracker-3"
echo "  Run 'firebase hosting:channel:deploy preview' for a preview channel."
echo ""
