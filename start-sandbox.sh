#!/bin/bash
# ==========================================
# OpenSandbox 沙箱服务启动脚本
# ==========================================
set -e

ROOT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
API_KEY="${SANDBOX_API_KEY:-ainote-local-dev}"
SANDBOX_PORT="${SANDBOX_PORT:-5002}"

echo "=========================================="
echo "   OpenSandbox Server 启动脚本"
echo "=========================================="

# 1. 检查 Docker 是否运行
echo ""
echo "🔍 检查 Docker 环境..."
if ! docker info >/dev/null 2>&1; then
  echo "❌ 错误: Docker 未运行或无权限访问。请先启动 Docker Desktop/Engine。"
  exit 1
fi
echo "✅ Docker 已就绪"

# 2. 检查 opensandbox-server 是否已安装
echo ""
echo "🔍 检查 opensandbox-server..."
if ! command -v opensandbox-server >/dev/null 2>&1; then
  echo "⬇️  未检测到 opensandbox-server，正在安装..."
  if command -v uv >/dev/null 2>&1; then
    uv pip install opensandbox-server
  elif command -v pip3 >/dev/null 2>&1; then
    pip3 install opensandbox-server
  elif command -v pip >/dev/null 2>&1; then
    pip install opensandbox-server
  else
    echo "❌ 错误: 未找到 uv/pip。请先安装 Python 和包管理器。"
    exit 1
  fi
  echo "✅ opensandbox-server 安装完成"
else
  echo "✅ opensandbox-server 已安装"
fi

# 3. 生成默认配置文件（如不存在）
SANDBOX_DATA_DIR="$ROOT_DIR/.sandbox"
mkdir -p "$SANDBOX_DATA_DIR"
SANDBOX_CONFIG="$SANDBOX_DATA_DIR/config.toml"

if [ ! -f "$SANDBOX_CONFIG" ]; then
  echo ""
  echo "⚙️  生成配置文件..."
  opensandbox-server init-config "$SANDBOX_CONFIG" --example docker 2>/dev/null || {
    # 手动写入最小配置
    cat > "$SANDBOX_CONFIG" << EOF
[server]
host = "0.0.0.0"
port = $SANDBOX_PORT
api_key = "$API_KEY"

[runtime]
type = "docker"
execd_image = "opensandbox/execd:latest"
default_image = "python:3.12-slim"
default_timeout = 600
EOF
    echo "✅ 使用默认配置"
  }
fi

# 4. 检查端口是否已被占用
echo ""
if lsof -i :$SANDBOX_PORT >/dev/null 2>&1; then
  echo "⚠️  端口 $SANDBOX_PORT 已被占用，OpenSandbox 可能已在运行"
  echo "   如需重启，请先终止占用进程后再执行本脚本"
  exit 0
fi

# 5. 启动服务
echo ""
echo "🚀 正在启动 OpenSandbox Server..."
echo "   API Key: $API_KEY"
echo "   端口:    $SANDBOX_PORT"
echo "   配置:    $SANDBOX_CONFIG"
echo ""

opensandbox-server --config "$SANDBOX_CONFIG"
