#!/usr/bin/env bash
set -euo pipefail

INTERVAL="${1:-60}"
LOG_DIR="${MEM_LOG_DIR:-$HOME/Desktop/mem_snapshots}"
HOT_THRESHOLD_KB="${MEM_HOT_THRESHOLD_KB:-1048576}"
HOT_CHILD_THRESHOLD_KB="${MEM_HOT_CHILD_THRESHOLD_KB:-262144}"
HOT_COOLDOWN_SEC="${MEM_HOT_COOLDOWN_SEC:-300}"
mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/memwatch-$(date +%Y%m%d).log"
HOT_STATE_FILE="$LOG_DIR/.memwatch-hot.last"

process_rss_kb() {
  /bin/ps -o rss= -p "$1" 2>/dev/null | /usr/bin/tr -d ' ' || true
}

process_cmd() {
  /bin/ps -o command= -p "$1" 2>/dev/null || true
}

process_cwd() {
  /usr/sbin/lsof -a -p "$1" -d cwd -Fn 2>/dev/null | /usr/bin/sed -n 's/^n//p' | /usr/bin/head -n 1
}

process_class() {
  case "$1" in
    *chrome-devtools-mcp*|*chrome-devtools*)
      echo "chrome-devtools"
      ;;
    *@21st-dev/magic*|*"/.bin/magic"*)
      echo "magic21st"
      ;;
    *codex*)
      echo "codex"
      ;;
    *node*)
      echo "node"
      ;;
    *npm*)
      echo "npm"
      ;;
    *git*)
      echo "git"
      ;;
    *)
      echo "other"
      ;;
  esac
}

collect_descendants() {
  local pid="$1"
  local children child
  children="$(/usr/bin/pgrep -P "$pid" || true)"
  for child in $children; do
    echo "$child"
    collect_descendants "$child"
  done
}

collect_codex_family() {
  local roots="$1"
  (
    for pid in $roots; do
      echo "$pid"
      collect_descendants "$pid"
    done
  ) | /usr/bin/awk 'NF && !seen[$1]++ { print $1 }'
}

print_process_details() {
  local pid="$1"
  local prefix="$2"
  local output_file="$3"
  local row cmd cwd klass
  row="$(/bin/ps -o pid=,ppid=,rss=,pcpu=,etime=,state= -p "$pid" 2>/dev/null || true)"
  [ -n "$row" ] || return 0
  cmd="$(process_cmd "$pid")"
  cwd="$(process_cwd "$pid")"
  klass="$(process_class "$cmd")"
  echo "${prefix}${row} class=${klass}" >> "$output_file"
  echo "${prefix}cmd=${cmd}" >> "$output_file"
  if [ -n "$cwd" ]; then
    echo "${prefix}cwd=${cwd}" >> "$output_file"
  fi
}

print_process_tree() {
  local pid="$1"
  local depth="$2"
  local output_file="$3"
  local indent child children
  indent="$(printf '%*s' $((depth * 2)) '')"
  print_process_details "$pid" "${indent}" "$output_file"
  children="$(/usr/bin/pgrep -P "$pid" || true)"
  for child in $children; do
    print_process_tree "$child" $((depth + 1)) "$output_file"
  done
}

write_hot_snapshot() {
  local roots="$1"
  local total_rss="$2"
  local largest_child_rss="$3"
  local hot_file now last_hot
  now="$(/bin/date +%s)"
  last_hot="$(/bin/cat "$HOT_STATE_FILE" 2>/dev/null || echo 0)"

  if [ $((now - last_hot)) -lt "$HOT_COOLDOWN_SEC" ]; then
    return 0
  fi

  hot_file="$LOG_DIR/codex-hot-$(/bin/date +%Y%m%d-%H%M%S).log"
  {
    echo "=== $(/bin/date '+%Y-%m-%d %H:%M:%S %z') ==="
    echo "codex roots: $roots"
    echo "codex family total rss_kb: $total_rss"
    echo "largest codex descendant rss_kb: $largest_child_rss"
    echo "--- vm_stat ---"
    /usr/bin/vm_stat
    echo "--- codex family tree ---"
  } >> "$hot_file"

  for pid in $roots; do
    print_process_tree "$pid" 0 "$hot_file"
  done

  /bin/echo "$now" > "$HOT_STATE_FILE"
}

snapshot() {
  CODEX_FAMILY=""
  echo "=== $(date '+%Y-%m-%d %H:%M:%S %z') ===" >> "$LOG_FILE"
  echo "uptime: $(uptime)" >> "$LOG_FILE"
  echo "--- vm_stat ---" >> "$LOG_FILE"
  /usr/bin/vm_stat >> "$LOG_FILE"

  echo "--- top rss (KB) ---" >> "$LOG_FILE"
  /bin/ps -axo pid,ppid,comm,rss | /usr/bin/sort -nrk4 | /usr/bin/head -n 25 >> "$LOG_FILE"

  echo "--- codex tree (KB) ---" >> "$LOG_FILE"
  CODEX_PIDS="$(/usr/bin/pgrep -x codex || true)"
  if [ -z "$CODEX_PIDS" ]; then
    echo "codex: not running" >> "$LOG_FILE"
  else
    echo "codex pids: $CODEX_PIDS" >> "$LOG_FILE"
    CODEX_FAMILY="$(collect_codex_family "$CODEX_PIDS")"
    total_rss=0
    largest_child_rss=0
    for pid in $CODEX_FAMILY; do
      rss_kb="$(process_rss_kb "$pid")"
      if [ -n "$rss_kb" ]; then
        total_rss=$((total_rss + rss_kb))
        if [ "$rss_kb" -gt "$largest_child_rss" ]; then
          largest_child_rss="$rss_kb"
        fi
      fi
    done
    echo "codex family total rss_kb: $total_rss" >> "$LOG_FILE"
    echo "largest codex descendant rss_kb: $largest_child_rss" >> "$LOG_FILE"

    echo "--- codex process tree ---" >> "$LOG_FILE"
    for cpid in $CODEX_PIDS; do
      print_process_tree "$cpid" 0 "$LOG_FILE"
    done

    if [ "$total_rss" -ge "$HOT_THRESHOLD_KB" ] || [ "$largest_child_rss" -ge "$HOT_CHILD_THRESHOLD_KB" ]; then
      write_hot_snapshot "$CODEX_PIDS" "$total_rss" "$largest_child_rss"
    fi
  fi

  echo "--- codex descendants by rss (KB) ---" >> "$LOG_FILE"
  if [ -z "${CODEX_FAMILY:-}" ]; then
    echo "codex: not running" >> "$LOG_FILE"
  else
    for pid in $CODEX_FAMILY; do
      rss_kb="$(process_rss_kb "$pid")"
      cmd="$(process_cmd "$pid")"
      printf "%10s %7s %s\n" "${rss_kb:-0}" "$pid" "$(process_class "$cmd")" >> "$LOG_FILE"
      echo "cmd=$cmd" >> "$LOG_FILE"
    done
  fi

  echo "--- heavy node (>512MB) ---" >> "$LOG_FILE"
  /bin/ps -axo pid,ppid,comm,rss | /usr/bin/awk '$3 == "node" && $4 >= 524288 { print }' >> "$LOG_FILE"

  echo "--- node details (cmd + cwd) ---" >> "$LOG_FILE"
  NODE_PIDS="$(/usr/bin/pgrep -x node || true)"
  if [ -z "$NODE_PIDS" ]; then
    echo "node: not running" >> "$LOG_FILE"
  else
    for pid in $NODE_PIDS; do
      rss="$(/bin/ps -o rss= -p "$pid" | /usr/bin/tr -d ' ' || true)"
      cmd="$(/bin/ps -o command= -p "$pid" 2>/dev/null || true)"
      echo "node pid=$pid rss_kb=${rss:-0} cmd=$cmd" >> "$LOG_FILE"
      cwd="$(/usr/sbin/lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | /usr/bin/sed -n 's/^n//p' | /usr/bin/head -n 1)"
      if [ -n "$cwd" ]; then
        echo "cwd: $cwd" >> "$LOG_FILE"
      fi
    done
  fi

  echo "--- chrome-devtools ---" >> "$LOG_FILE"
  /usr/bin/pgrep -fl chrome-devtools || echo "none" >> "$LOG_FILE"

  echo "" >> "$LOG_FILE"
}

while true; do
  snapshot
  /bin/sleep "$INTERVAL"
done
