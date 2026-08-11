# --- 阶段 1: 构建阶段 ---
FROM node:20-slim AS build

WORKDIR /app

# 使用 corepack 启用 pnpm（Node 20 自带，无需 npm 安装）
RUN corepack enable && corepack prepare pnpm@9 --activate

# 复制依赖定义 (从 root context 下的 client 目录)
COPY client/package.json client/pnpm-lock.yaml* ./client/

# 复制共享代码目录 (构建时必需)
COPY 1shared ./1shared

# 进入 client 目录安装依赖
WORKDIR /app/client
# 使用 --no-frozen-lockfile 以确保在 Docker 环境下能正确处理可能的依赖变动
RUN pnpm install --no-frozen-lockfile

# 复制前端源代码
COPY client/ ./

# 进行构建 (进一步增加内存限制并关闭 sourcemap 以节省内存)
RUN GENERATE_SOURCEMAP=false NODE_OPTIONS="--max-old-space-size=8192" pnpm run build

# --- 阶段 2: 运行阶段 ---
FROM nginx:stable-alpine

# 将构建好的文件复制到 Nginx 目录
COPY --from=build /app/client/dist /usr/share/nginx/html

# 复制自定义 Nginx 配置，包含 /api/ 到后端代理
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
