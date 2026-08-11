# AINote — AI 智能体工作流平台

[English](README.md)

一款 AI 智能体工作流平台，支持可视化流程编排、知识库管理以及多模型 LLM 集成，帮助您构建智能应用。

## 功能特性

- **可视化工作流编辑器** — 拖拽式流程搭建，支持分支、循环和 AI 节点
- **知识库** — 文档导入、向量检索（pgvector）与 RAG 管道
- **AI 智能体工作室** — 多模型 LLM 集成（OpenAI、DeepSeek、Qwen 等），工具编排
- **块笔记编辑器** — 支持 AI 辅助的富文本协作编辑器
- **代码沙箱** — 基于 OpenSandbox 的安全远程代码执行
- **多租户** — 基于组织的工作空间，支持邀请码和成员管理
- **可扩展存储** — 支持本地、七牛云、阿里云 OSS 及 S3 兼容存储后端

## 架构

```
┌──────────────────────────────┐
│         Client (React)       │  端口 5000 (开发) / 8081 (生产)
│   Vite + Ant Design + Flow   │
└─────────────┬────────────────┘
              │ HTTP / WebSocket
┌─────────────┴────────────────┐
│     Server (Express + Node)  │  端口 5001
│   REST API + 工作流引擎       │
└──────┬───────┬───────┬───────┘
       │       │       │
┌──────┴─┐ ┌───┴───┐ ┌─┴────────┐
│Postgres│ │Temporal│ │Markitdown │
│+vector │ │ 7233   │ │ 6010      │
│+graph  │ └───────┘ └──────────┘
└────────┘
```

## 快速开始（GHCR 镜像）— 最简单

使用 GitHub Container Registry 预构建镜像部署。无需源码、无需构建工具、无需 Node.js，仅需 Docker。

> **私有仓库？** 请先登录：`docker login ghcr.io -u YOUR_USERNAME`

```bash
# 1. 下载部署文件
curl -O https://raw.githubusercontent.com/yangzc/ainote/main/docker-compose.ghcr.yml
curl -O https://raw.githubusercontent.com/yangzc/ainote/main/.env.example
mkdir -p server
curl -o server/.env.example https://raw.githubusercontent.com/yangzc/ainote/main/server/.env.example

# 2. 准备配置文件
cp .env.example .env
cp server/.env.example server/.env

# 3. 编辑配置 — 至少设置 JWT_SECRET 和一个 LLM API Key
#    .env          → 基础设施配置（端口、数据库密码等）
#    server/.env   → 应用配置（LLM 密钥、JWT 秘钥等）

# 4. 启动所有服务
docker compose -f docker-compose.ghcr.yml up -d

# 5. 访问
# 前端: http://localhost:8081
# 后端:  http://localhost:5001
```

**您只需要这 3 个文件：**

| 文件 | 用途 |
|------|------|
| `docker-compose.ghcr.yml` | 使用预构建镜像的 Docker 编排文件 |
| `.env` | 基础设施变量（端口、数据库凭证） |
| `server/.env` | 应用配置（LLM API 密钥、JWT 秘钥） |

技术栈包含：PostgreSQL（含 pgvector、AGE、zhparser 中文分词）、Temporal 服务器、后端、前端及 Python Markitdown 服务 — 全部以容器方式运行。

---

## 快速开始（Docker Compose — 源码构建）

从源码本地构建镜像。需要克隆仓库并安装 Docker。

### 环境要求

| 依赖 | 版本 | 是否必需 | 说明 |
|------------|---------|----------|------|
| Node.js | ≥ 20 | 必需 | 后端 + 前端 |
| pnpm | ≥ 8 | 必需 | 前后端包管理器 |
| Python | ≥ 3.10 | 可选 | 文档转换服务 |
| PostgreSQL | ≥ 15 | 必需 | 需安装 pgvector 扩展 |
| Temporal | 1.24+ | 推荐 | 工作流引擎 |

### Docker Compose（源码构建）

最快的一键启动方式：

```bash
# 1. 克隆仓库
git clone <repository_url>
cd ainote

# 2. 准备环境配置
cp .env.example .env
cp server/.env.example server/.env
# 编辑 server/.env — 至少设置 JWT_SECRET 和一个 LLM API Key

# 3. 启动所有服务
docker compose up -d

# 4. 访问应用
# 前端: http://localhost:8081
# 后端:  http://localhost:5001
# Temporal UI（可选）: docker compose --profile debug up -d  →  http://localhost:8233
```

Docker 环境包含：PostgreSQL（含 pgvector、AGE、zhparser 中文分词）、Temporal 服务器、后端、前端及 Python Markitdown 服务。Temporal UI 为可选服务（使用 `--profile debug`）。

## 手动部署（裸机）

### 1. 基础设施服务

启动应用前，需要以下服务先运行：

#### PostgreSQL（含扩展）

```bash
# 安装 PostgreSQL 15+，然后启用扩展：
psql -U postgres -c "CREATE EXTENSION IF NOT EXISTS vector;"
psql -U postgres -c "CREATE EXTENSION IF NOT EXISTS age;"
psql -U postgres -c "CREATE EXTENSION IF NOT EXISTS zhparser;"
```

#### Temporal（可选，用于工作流）

```bash
# 使用提供的脚本：
bash start-temporal.sh

# 或手动启动：
temporal server start-dev --db-port 5432
```

#### Python Markitdown（可选，用于文档转换）

```bash
cd python
pip install -r requirements.txt
python server.py  # 启动在 6010 端口
```

### 2. 服务端设置

```bash
cd server

# 安装依赖
pnpm install

# 初始化数据库扩展
pnpm run db:init

# 配置环境变量
cp .env.example .env
# 编辑 .env — 设置 JWT_SECRET、数据库地址、LLM 密钥（见下方配置说明）

# 开发模式启动
pnpm run dev

# 或带工作流 Worker 启动
pnpm run dev:worker
```

服务端默认运行在 `http://localhost:5001`。

### 3. 客户端设置

```bash
cd client

# 安装依赖
pnpm install

# 启动开发服务器
pnpm run dev
```

客户端默认运行在 `http://localhost:5000`。无需 `.env` 文件 — 所有默认配置开箱即用。

### 4. 验证

```bash
# 检查后端健康状态
curl http://localhost:5001/api/v1/health

# 打开前端
open http://localhost:5000
```

## 最简配置

> 将以下内容复制粘贴为 `server/.env`。将 `<...>` 占位符替换为您自己的值。  
> 客户端**无需** `.env` 文件 — `VITE_API_URL` 默认为 `/api/v1`。

```bash
# ============================================================
# 服务端
# ============================================================
PORT=5001
CLIENT_ORIGIN=http://localhost:5173,http://localhost:5000,http://localhost:8081
MAX_FILE_SIZE_MB=10
MAX_ATTACHMENT_FILE_SIZE_MB=20
DEFAULT_TOKEN_BALANCE=100000

# ============================================================
# 安全
# ============================================================
# 生成方式：openssl rand -hex 64
JWT_SECRET=<your-jwt-secret>

# ============================================================
# 数据库（PostgreSQL + pgvector）
# ============================================================
VECTOR_POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/ainote

# ============================================================
# 工作流引擎（Temporal）
# ============================================================
TEMPORAL_SERVER_URL=localhost:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=ainote-workflows
START_TEMPORAL_WORKER=true

# ============================================================
# 存储（local | qiniu | oss | s3）
# ============================================================
STORAGE_PROVIDER=local
# QINIU_ACCESS_KEY=<your-qiniu-access-key>
# QINIU_SECRET_KEY=<your-qiniu-secret-key>
# QINIU_BUCKET=<your-bucket>
# QINIU_DOMAIN=<your-domain>

# ============================================================
# LLM 提供商（至少配置一个）
#   格式：LLM_{PROVIDER}_{SETTING}
# ============================================================
# 提供商：OpenAI / 兼容 API（必需）
LLM_OPENAI_API_KEY=sk-<your-openai-key>
LLM_OPENAI_BASE_URL=https://api.openai.com/v1
LLM_OPENAI_MODEL=gpt-4o

# 提供商：DeepSeek（可选）
# LLM_DEEPSEEK_API_KEY=sk-<your-deepseek-key>
# LLM_DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
# LLM_DEEPSEEK_MODEL=deepseek-chat

# 提供商：Qwen / 百炼（可选）
# LLM_QWEN_API_KEY=sk-<your-qwen-key>
# LLM_QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
# LLM_QWEN_MODEL=qwen-plus

# 提供商：OneAPI / 代理聚合（可选）
# LLM_ONEAPI_API_KEY=sk-<your-oneapi-key>
# LLM_ONEAPI_BASE_URL=https://your-oneapi-host/v1
# LLM_ONEAPI_MODEL=gpt-4o,claude-3.5-sonnet

LLM_DEFAULT_PROVIDER=openai

# ============================================================
# 向量嵌入（默认使用 LLM 提供商 API）
# ============================================================
EMBEDDING_PROVIDER=openai
EMBEDDING_API_URL=https://api.openai.com/v1
EMBEDDING_API_KEY=sk-<your-embedding-key>
EMBEDDING_MODEL_NAME=text-embedding-3-small
EMBEDDING_DIMENSION=1536

# ============================================================
# 向量记忆（mem0ai）
# ============================================================
MEMORY_PROVIDER=pgvector

# ============================================================
# 文档转换（Markitdown）
# ============================================================
MARKITDOWN_SERVICE_URL=http://127.0.0.1:6010/v1/convert

# ============================================================
# 邀请码
# ============================================================
FIXED_INVITATION_CODE=SIT2024
DEFAULT_INVITATION_SLOTS=5

# ============================================================
# WeTinker 网关（可选，企业版）
# ============================================================
WETINKER_API_BASE_URL=

# ============================================================
# 沙箱（代码执行，可选）
# ============================================================
SANDBOX_ENABLED=false
# SANDBOX_SERVER_URL=http://localhost:5002
# SANDBOX_API_KEY=<your-sandbox-key>
# SANDBOX_USE_SERVER_PROXY=false
# SANDBOX_IMAGE=python:3.12-alpine
# SANDBOX_TIMEOUT=300
```

> 完整变量说明见下方 [完整配置参考](#完整配置参考)。

## 完整配置参考

### 服务端环境变量 (`server/.env`)

所有配置均在 `server/.env` 中。从模板复制：

```bash
cp server/.env.example server/.env
```

#### 必需项

| 变量 | 说明 |
|----------|-------------|
| `JWT_SECRET` | JWT 签名密钥。生成方式：`openssl rand -hex 64` |
| `VECTOR_POSTGRES_URL` | PostgreSQL 连接串：`postgresql://user:pass@host:5432/ainote` |
| `LLM_OPENAI_API_KEY` | 至少一个 LLM 提供商的 API 密钥 |

#### LLM 提供商

支持的提供商：OpenAI、DeepSeek、Qwen、OneAPI（代理聚合）。

```
LLM_OPENAI_API_KEY=sk-xxx
LLM_OPENAI_BASE_URL=https://api.openai.com/v1
LLM_OPENAI_MODEL=gpt-4o
LLM_DEFAULT_PROVIDER=openai
```

其他提供商可通过 `LLM_{PROVIDER}_{SETTING}` 格式配置 — 详见 `.env.example` 中的全部选项。

#### 数据库

| 变量 | 默认值 | 说明 |
|----------|---------|-------------|
| `VECTOR_POSTGRES_URL` | — | PostgreSQL 完整连接字符串 |

#### 存储

| 变量 | 默认值 | 说明 |
|----------|---------|-------------|
| `STORAGE_PROVIDER` | `local` | `local`、`qiniu`、`oss` 或 `s3` |
| `QINIU_ACCESS_KEY` | — | 七牛云 Access Key |
| `QINIU_SECRET_KEY` | — | 七牛云 Secret Key |
| `QINIU_BUCKET` | — | 七牛云 Bucket 名称 |
| `QINIU_DOMAIN` | — | 七牛云 CDN 域名 |

#### 工作流引擎（Temporal）

| 变量 | 默认值 |
|----------|---------|
| `TEMPORAL_SERVER_URL` | `localhost:7233` |
| `TEMPORAL_NAMESPACE` | `default` |
| `TEMPORAL_TASK_QUEUE` | `ainote-workflows` |
| `START_TEMPORAL_WORKER` | `true` |

#### 沙箱（代码执行）

| 变量 | 默认值 | 说明 |
|----------|---------|-------------|
| `SANDBOX_ENABLED` | `false` | 启用远程代码执行 |
| `SANDBOX_SERVER_URL` | `localhost:5002` | 沙箱服务器地址 |
| `SANDBOX_API_KEY` | — | 认证密钥 |

详见 [沙箱部署指南](sandbox/README.md)。

#### 其他

| 变量 | 默认值 | 说明 |
|----------|---------|-------------|
| `CLIENT_ORIGIN` | `http://localhost:5173,http://localhost:8081` | CORS 来源（逗号分隔） |
| `FIXED_INVITATION_CODE` | `SIT2024` | 注册邀请码 |
| `DEFAULT_TOKEN_BALANCE` | `100000` | 新用户初始 Token 余额 |
| `EMBEDDING_PROVIDER` | `openai` | 向量嵌入提供商 |
| `EMBEDDING_MODEL_NAME` | `text-embedding-3-small` | 向量嵌入模型 |
| `MEMORY_PROVIDER` | `pgvector` | 向量记忆后端（使用 PostgreSQL pgvector） |
| `MARKITDOWN_SERVICE_URL` | `http://127.0.0.1:6010/v1/convert` | 文档转换服务端点 |

## 项目结构

```
ainote/
├── client/                    # React 前端（Vite + Ant Design）
│   └── src/
│       ├── api/               # API 客户端
│       ├── components/        # 共享 UI 组件
│       ├── pages/             # 路由页面
│       │   └── workflow/      # 可视化工作流编辑器
│       ├── i18n.js            # 国际化
│       └── sdk/               # 可嵌入 SDK
├── server/                    # Node.js/Express 后端
│   ├── index.js               # 应用入口
│   ├── config/                # 配置（环境变量、数据库、日志）
│   ├── routes/                # API 路由
│   ├── services/              # 业务逻辑服务
│   ├── controllers/           # 请求处理器
│   ├── middleware/             # Express 中间件
│   ├── temporal/              # Temporal 工作流与活动
│   └── scripts/               # 工具脚本（数据库初始化、种子数据）
├── python/                    # Markitdown 文档转换服务
├── docker/                    # PostgreSQL 自定义镜像构建
├── 1shared/                   # 共享代码（客户端 ↔ 服务端）
├── sandbox/                   # OpenSandbox 部署指南
├── docs/                      # 文档
├── docker-compose.yml         # 全栈 Docker 编排（源码构建）
├── docker-compose.ghcr.yml    # 全栈 Docker 编排（GHCR 预构建镜像）
└── *.sh                       # 基础设施启动脚本
```

## 开发指南

### 服务端

```bash
cd server
pnpm run dev         # 热重载启动（nodemon + tsx）
pnpm run test        # 运行测试（vitest）
pnpm run lint        # ESLint 代码检查
pnpm run format      # Prettier 代码格式化
pnpm run db:push     # 推送数据库结构变更
```

### 客户端

```bash
cd client
pnpm run dev         # 启动开发服务器（端口 5000）
pnpm run build       # 生产构建
pnpm run preview     # 预览生产构建
```

### 查看日志

```bash
cat app.1.log | pino-pretty
```

## 许可证

[MIT](LICENSE)
