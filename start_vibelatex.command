#!/bin/bash

set -u

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR" || exit 1

echo "========================================"
echo " VibeLaTeX 一键启动"
echo "========================================"

if ! command -v node >/dev/null 2>&1; then
  echo "[错误] 未检测到 Node.js。"
  echo "请先安装 Node.js（推荐 24.x）：https://nodejs.org/en/download"
  open "https://nodejs.org/en/download" >/dev/null 2>&1 || true
  echo
  read -r -p "安装完成后按回车关闭窗口..."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[错误] 未检测到 npm。"
  echo "请重新安装 Node.js 后再试。"
  echo
  read -r -p "按回车关闭窗口..."
  exit 1
fi

NODE_VERSION="$(node -v | sed 's/^v//')"
NODE_MAJOR="${NODE_VERSION%%.*}"
if [ "${NODE_MAJOR:-0}" -lt 20 ]; then
  echo "[提示] 当前 Node.js 版本为 v$NODE_VERSION，建议使用 20+（推荐 24.x）。"
fi

if [ ! -d node_modules ] || [ package-lock.json -nt node_modules ]; then
  echo
  echo "[1/2] 正在安装依赖（首次运行可能需要几分钟）..."
  if ! npm install; then
    echo "[错误] 依赖安装失败，请检查网络后重试。"
    echo
    read -r -p "按回车关闭窗口..."
    exit 1
  fi
else
  echo
  echo "[1/2] 依赖已就绪，跳过安装。"
fi

pick_port() {
  local p=3000
  while lsof -iTCP:"$p" -sTCP:LISTEN -Pn >/dev/null 2>&1; do
    p=$((p + 1))
    if [ "$p" -gt 3010 ]; then
      return 1
    fi
  done
  echo "$p"
}

PORT="$(pick_port)"
if [ -z "$PORT" ]; then
  echo "[错误] 3000-3010 端口都被占用，请关闭占用程序后重试。"
  echo
  read -r -p "按回车关闭窗口..."
  exit 1
fi

echo "[2/2] 正在启动服务..."
echo

echo "编辑页:  http://localhost:$PORT"
echo "管理页:  http://localhost:$PORT/admin"
echo "停止服务: 在本窗口按 Ctrl + C"

(
  sleep 3
  open "http://localhost:$PORT" >/dev/null 2>&1 || true
) &

npm run dev -- --port "$PORT"
EXIT_CODE=$?

echo
echo "服务已停止（退出码: $EXIT_CODE）"
read -r -p "按回车关闭窗口..."
exit "$EXIT_CODE"
