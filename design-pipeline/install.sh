#!/usr/bin/env bash
# web-design-pipeline installer: taste-skill + ui-ux-pro-max + impeccable + the pipeline skill, side by side.
#
#   ./install.sh                     install for every project on this machine (~/.claude/skills)
#   ./install.sh --project DIR       install into DIR/.claude/skills (commit it so cloud sessions get it too)
#   ./install.sh --agents            also install into ~/.agents/skills (Codex and other Agent Skills readers)
#   ./install.sh --latest            use each upstream's newest commit instead of the pins (prints the new pins)
#   ./install.sh --uninstall [--project DIR]
#
# Needs git, Node 22+, Python 3 and a Chrome / Edge / Chromium. Free tools only; no API keys.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCK="$HERE/pipeline.lock.json"
CACHE="${DP_CACHE:-$HOME/.cache/web-design-pipeline}"
targets=("$HOME/.claude/skills"); project=""; latest=0; mode=install
while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) project="$(cd "$2" && pwd)"; targets=("$project/.claude/skills"); shift ;;
    --agents) targets+=("$HOME/.agents/skills") ;;
    --latest) latest=1 ;;
    --uninstall) mode=uninstall ;;
    -h|--help) sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

names() { python3 -c "import json,sys;[print(s['name'],s['repo'],s['commit'],s['path'],' '.join(s['licenseFiles'])) for s in json.load(open(sys.argv[1]))['skills']]" "$LOCK"; }

if [[ $mode == uninstall ]]; then
  for t in "${targets[@]}"; do
    while read -r name _; do rm -rf "${t:?}/$name"; done < <(names)
    rm -rf "${t:?}/web-design-pipeline"; echo "removed from $t"
  done
  exit 0
fi

command -v git >/dev/null || { echo "git is required" >&2; exit 1; }
mkdir -p "$CACHE"
while read -r name repo commit path licenses; do
  src="$CACHE/$name"
  if [[ ! -d "$src/.git" ]]; then git init -q "$src"; git -C "$src" remote add origin "$repo"; fi
  if [[ $latest == 1 ]]; then
    git -C "$src" fetch -q --depth 1 origin HEAD && git -C "$src" checkout -q --force FETCH_HEAD
    echo "pin for $name: $(git -C "$src" rev-parse HEAD)  (update $LOCK after testing)"
  else
    if [[ "$(git -C "$src" rev-parse HEAD 2>/dev/null || true)" != "$commit" ]]; then
      git -C "$src" fetch -q --depth 1 origin "$commit" && git -C "$src" checkout -q --force FETCH_HEAD
    fi
  fi
  for t in "${targets[@]}"; do
    mkdir -p "$t"; rm -rf "${t:?}/$name"; cp -R "$src/$path" "$t/$name"
    for f in $licenses; do [[ -f "$src/$f" ]] && cp "$src/$f" "$t/$name/UPSTREAM-$f"; done
    printf '%s\n%s\n' "$repo" "$(git -C "$src" rev-parse HEAD)" > "$t/$name/UPSTREAM"
  done
  echo "installed $name ($(git -C "$src" rev-parse --short HEAD))"
done < <(names)

for t in "${targets[@]}"; do rm -rf "${t:?}/web-design-pipeline"; cp -R "$HERE/skills/web-design-pipeline" "$t/"; done
echo "installed web-design-pipeline"

# impeccable: no anonymous usage data (the engine reads this file; it is downloaded on first use and checksum-verified)
mkdir -p "$HOME/.impeccable"
[[ -f "$HOME/.impeccable/config.json" ]] || echo '{ "telemetry": false }' > "$HOME/.impeccable/config.json"

node -e 'process.exit(+process.versions.node.split(".")[0] >= 22 ? 0 : 1)' 2>/dev/null || echo "warning: Node 22+ is needed for the taste and QA scripts"
command -v python3 >/dev/null || echo "warning: Python 3 is needed for ui-ux-pro-max search"
echo "done → ${targets[*]}"
echo "use: ask Claude to build or improve a website; the web-design-pipeline skill runs the stages."
