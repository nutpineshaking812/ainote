#!/bin/bash

# 查找并杀死所有 node 进程
echo "正在停止所有 Node.js 服务..."

# 使用 pkill 匹配包含 'node' 的进程
# -f 检查完整的命令行
pkill -f node

if [ $? -eq 0 ]; then
  echo "所有 Node.js 进程已成功停止。"
else
  echo "没有发现正在运行的 Node.js 进程，或者停止失败。"
fi
