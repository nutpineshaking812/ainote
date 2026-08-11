#!/bin/bash

# ==========================================
# Qdrant 自动安装与启动脚本
# ==========================================

# 获取脚本所在目录
ROOT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
QDRANT_DIR="$ROOT_DIR/qdrant_bin"
QDRANT_BIN="$QDRANT_DIR/qdrant"
QDRANT_STATIC="$QDRANT_DIR/static"
QDRANT_VERSION="v1.17.0"
UI_VERSION="v0.2.7"

mkdir -p "$QDRANT_DIR"

# 1. 检测并安装 Qdrant 二进制文件
if [ ! -f "$QDRANT_BIN" ]; then
    echo "⬇️  未检测到 Qdrant，正在下载 $QDRANT_VERSION..."
    
    # 检测架构和操作系统
    ARCH=$(uname -m)
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    
    if [ "$OS" == "darwin" ]; then
        if [ "$ARCH" == "arm64" ]; then
            DOWNLOAD_URL="https://github.com/qdrant/qdrant/releases/download/$QDRANT_VERSION/qdrant-aarch64-apple-darwin.tar.gz"
        else
            DOWNLOAD_URL="https://github.com/qdrant/qdrant/releases/download/$QDRANT_VERSION/qdrant-x86_64-apple-darwin.tar.gz"
        fi
    elif [ "$OS" == "linux" ]; then
        if [ "$ARCH" == "aarch64" ] || [ "$ARCH" == "arm64" ]; then
            DOWNLOAD_URL="https://github.com/qdrant/qdrant/releases/download/$QDRANT_VERSION/qdrant-aarch64-unknown-linux-musl.tar.gz"
        else
            DOWNLOAD_URL="https://github.com/qdrant/qdrant/releases/download/$QDRANT_VERSION/qdrant-x86_64-unknown-linux-musl.tar.gz"
        fi
    else
        echo "❌ 不支持的操作系统: $OS"
        exit 1
    fi

    curl -L "$DOWNLOAD_URL" -o "$QDRANT_DIR/qdrant.tar.gz"
    tar -xzf "$QDRANT_DIR/qdrant.tar.gz" -C "$QDRANT_DIR"
    rm "$QDRANT_DIR/qdrant.tar.gz"
    chmod +x "$QDRANT_BIN"
    echo "✅ Qdrant 二进制文件安装成功 ($OS $ARCH)"
fi

# 2. 检测并安装 Web UI (Static files)
if [ ! -d "$QDRANT_STATIC" ] || [ -z "$(ls -A "$QDRANT_STATIC")" ]; then
    echo "⬇️  未检测到 Web UI，正在下载 $UI_VERSION..."
    mkdir -p "$QDRANT_STATIC"
    
    UI_URL="https://github.com/qdrant/qdrant-web-ui/releases/download/$UI_VERSION/dist-qdrant.zip"
    curl -L "$UI_URL" -o "$QDRANT_DIR/static.zip"
    
    # 尝试使用 unzip，如果不存在则尝试 python3
    if command -v unzip >/dev/null 2>&1; then
        unzip -o "$QDRANT_DIR/static.zip" -d "$QDRANT_DIR/static_tmp"
    elif command -v python3 >/dev/null 2>&1; then
        python3 -m zipfile -e "$QDRANT_DIR/static.zip" "$QDRANT_DIR/static_tmp"
    else
        echo "❌ 错误: 未找到 'unzip' 或 'python3'，无法解压 Web UI。请先安装 unzip (sudo apt install unzip)。"
        exit 1
    fi
    
    # 移动文件并清理
    if [ -d "$QDRANT_DIR/static_tmp/dist" ]; then
        mv "$QDRANT_DIR/static_tmp/dist"/* "$QDRANT_STATIC/"
    elif [ -d "$QDRANT_DIR/static_tmp" ]; then
        # 有些压缩包直接在根目录，或者在 dist 目录下
        if [ -d "$QDRANT_DIR/static_tmp/dist-qdrant" ]; then
             mv "$QDRANT_DIR/static_tmp/dist-qdrant"/* "$QDRANT_STATIC/"
        else
             mv "$QDRANT_DIR/static_tmp"/* "$QDRANT_STATIC/" 2>/dev/null || true
        fi
    fi
    
    rm -rf "$QDRANT_DIR/static_tmp" "$QDRANT_DIR/static.zip"
    echo "✅ Qdrant Web UI 安装成功"
fi

# 3. 启动服务
echo "=========================================="
echo "🚀 正在启动 Qdrant 向量数据库..."
echo "Web UI: http://localhost:6333/dashboard/"
echo "API 地址: http://localhost:6333"
echo "=========================================="

cd "$QDRANT_DIR"
# 阻塞运行
./qdrant
