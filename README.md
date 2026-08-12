# AINote — AI Agent Workflow Platform

[中文文档](README.zh-CN.md)

An AI agent workflow platform for building intelligent applications with visual flow orchestration, knowledge bases, and multi-model LLM integration.

## Screenshots

![Workflow Editor](docs/screenshots/workflow.png)

![Form Builder](docs/screenshots/form-builder.png)
![Digital Worker Chat](docs/screenshots/digital-worker.png)

![Dashboard & Charts](docs/screenshots/dashboard.png)

![Desktop Client](docs/screenshots/desktop-client.png)

## Features

- **Visual Workflow Editor** — Drag-and-drop flow builder with branching, loops, and AI nodes
- **Drag-and-Drop Form Builder** — 16+ field types (text, number, date, file upload, rich text, etc.), flexible grid layout, validation rules, publish and collect responses
- **Public Forms & External API** — Share forms with access codes and expiry, submit data via REST API with token/API-key authentication, manage records programmatically
- **Chart & View Builder** — AI-powered chart generation (bar, line, pie, area, table), drag-and-drop dashboard layout, real-time data visualization
- **Data Management** — Spreadsheet-like table view with inline editing, search, sort, filter, column freeze/hide, Excel import/export
- **Digital Workers** — Create AI agents with custom roles (Customer Support, Developer, Analyst, etc.), real-time chat with streaming responses
- **Digital Worker API & SDK** — Embed workers via iframe or JS SDK (`window.AiNoteChat`), streaming chat API for third-party integration, channel routing by tag
- **Third-Party Gateway** — Provider-based channel architecture for seamless integration with external platforms. Currently supports:
  - **DingTalk (钉钉)**: Stream Mode long connection, interactive cards with real-time streaming AI responses, voice message support. Connect DingTalk bots to digital workers for automated conversations
  - **WeTinker (企微运营)**: SSE-based messaging, intelligent tag-based worker routing, auto-reconnect with exponential backoff
  - Extensible provider interface — add new channels (Slack, Feishu, etc.) by implementing provider contracts
- **Knowledge Base** — Document ingestion, vector search (pgvector), and RAG pipelines
- **AI Agent Studio** — Multi-model LLM integration (OpenAI, DeepSeek, Qwen, etc.), tool orchestration
- **Block-Note Editor** — Rich-text collaborative editor with AI assistance
- **Code Sandbox** — Secure remote code execution via OpenSandbox
- **Multi-Tenant** — Organization-based workspace with invitation codes and member management
- **Extensible Storage** — Local, Qiniu, Aliyun OSS, or S3-compatible backends

## Architecture

```
┌──────────────────────────────┐
│         Client (React)       │  Port 5000 (dev) / 8081 (prod)
│   Vite + Ant Design + Flow   │
└─────────────┬────────────────┘
              │ HTTP / WebSocket
┌─────────────┴────────────────┐
│     Server (Express + Node)  │  Port 5001
│   REST API + Workflow Engine │
└──────┬───────┬───────┬───────┘
       │       │       │
┌──────┴─┐ ┌───┴───┐ ┌─┴────────┐
│Postgres│ │Temporal│ │Markitdown │
│+vector │ │ 7233   │ │ 6010      │
│+graph  │ └───────┘ └──────────┘
└────────┘
```

## Quick Start (GHCR Images) — Easiest

Deploy with pre-built images from GitHub Container Registry. No source code, no build tools, no Node.js needed. Only Docker required.

> **Private repository?** Login first: `docker login ghcr.io -u YOUR_USERNAME`

```bash
# 1. Download deployment files
curl -O https://raw.githubusercontent.com/yangzc/ainote/main/docker-compose.ghcr.yml
curl -O https://raw.githubusercontent.com/yangzc/ainote/main/.env.example
mkdir -p server
curl -o server/.env.example https://raw.githubusercontent.com/yangzc/ainote/main/server/.env.example

# 2. Prepare configuration
cp .env.example .env
cp server/.env.example server/.env

# 3. Edit the configs — at minimum set JWT_SECRET and one LLM API key
#    .env          → infrastructure (ports, DB password)
#    server/.env   → application (LLM keys, JWT secret, etc.)

# 4. Start all services
docker compose -f docker-compose.ghcr.yml up -d

# 5. Access
# Frontend: http://localhost:8081
# Backend:  http://localhost:5001
```

**You only need these 3 files:**
| File | Purpose |
|------|---------|
| `docker-compose.ghcr.yml` | Docker orchestration with pre-built images |
| `.env` | Infrastructure variables (ports, DB credentials) |
| `server/.env` | Application config (LLM API keys, JWT secret) |

The stack includes: PostgreSQL (with pgvector, AGE, zhparser), Temporal server, backend, frontend, and Python Markitdown service — all running as containers.

---

## Quick Start (Docker Compose — from source)

Build images locally from source. Requires cloning the repository and Docker.

## Prerequisites

| Dependency | Version | Required | Note |
|------------|---------|----------|------|
| Node.js | ≥ 20 | Required | Backend + Frontend |
| pnpm | ≥ 8 | Required | Server & Client package manager |
| Python | ≥ 3.10 | Optional | Document conversion service |
| PostgreSQL | ≥ 15 | Required | With pgvector extension |
| Temporal | 1.24+ | Recommended | Workflow engine |

### Docker Compose (from source)

The fastest way to get everything running:

```bash
# 1. Clone the repository
git clone <repository_url>
cd ainote

# 2. Prepare environment
cp .env.example .env
cp server/.env.example server/.env
# Edit server/.env — at minimum set JWT_SECRET and one LLM API key

# 3. Start all services
docker compose up -d

# 4. Access the application
# Frontend: http://localhost:8081
# Backend:  http://localhost:5001
# Temporal UI (optional): docker compose --profile debug up -d  →  http://localhost:8233
```

The docker stack includes: PostgreSQL (with pgvector, AGE, zhparser), Temporal server, backend, frontend, and Python Markitdown service. Temporal UI is optional (use `--profile debug`).

## Manual Setup (Bare-Metal)

### 1. Infrastructure Services

You'll need these running before starting the app:

#### PostgreSQL (with extensions)

```bash
# Install PostgreSQL 15+, then enable extensions:
psql -U postgres -c "CREATE EXTENSION IF NOT EXISTS vector;"
psql -U postgres -c "CREATE EXTENSION IF NOT EXISTS age;"
psql -U postgres -c "CREATE EXTENSION IF NOT EXISTS zhparser;"
```

#### Temporal (optional, for workflows)

```bash
# Using the provided script:
bash start-temporal.sh

# Or manually:
temporal server start-dev --db-port 5432
```

#### Python Markitdown (optional, for document conversion)

```bash
cd python
pip install -r requirements.txt
python server.py  # starts on port 6010
```

### 2. Server Setup

```bash
cd server

# Install dependencies
pnpm install

# Initialize database extensions
pnpm run db:init

# Configure environment
cp .env.example .env
# Edit .env — set JWT_SECRET, database URL, LLM keys (see Configuration below)

# Start in development mode
pnpm run dev

# Or start with workflow worker
pnpm run dev:worker
```

The server runs on `http://localhost:5001` by default.

### 3. Client Setup

```bash
cd client

# Install dependencies
pnpm install

# Start development server
pnpm run dev
```

The client runs on `http://localhost:5000` by default. No `.env` file is needed — all defaults work out of the box.

### 4. Verify

```bash
# Check backend health
curl http://localhost:5001/api/v1/health

# Open frontend
open http://localhost:5000
```

## Minimal Configuration

> Copy-paste the block below as `server/.env`. Replace `<...>` placeholders with your own values.  
> Client needs **no** `.env` file — `VITE_API_URL` defaults to `/api/v1`.

```bash
# ============================================================
# Server
# ============================================================
PORT=5001
CLIENT_ORIGIN=http://localhost:5173,http://localhost:5000,http://localhost:8081
MAX_FILE_SIZE_MB=10
MAX_ATTACHMENT_FILE_SIZE_MB=20
DEFAULT_TOKEN_BALANCE=100000

# ============================================================
# Security
# ============================================================
# Generate with: openssl rand -hex 64
JWT_SECRET=<your-jwt-secret>

# ============================================================
# Database (PostgreSQL + pgvector)
# ============================================================
VECTOR_POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/ainote

# ============================================================
# Workflow Engine (Temporal)
# ============================================================
TEMPORAL_SERVER_URL=localhost:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=ainote-workflows
START_TEMPORAL_WORKER=true

# ============================================================
# Storage (local | qiniu | oss | s3)
# ============================================================
STORAGE_PROVIDER=local
# QINIU_ACCESS_KEY=<your-qiniu-access-key>
# QINIU_SECRET_KEY=<your-qiniu-secret-key>
# QINIU_BUCKET=<your-bucket>
# QINIU_DOMAIN=<your-domain>

# ============================================================
# LLM Providers (at least one required)
#   Pattern: LLM_{PROVIDER}_{SETTING}
# ============================================================
# Provider: OpenAI / compatible API (required)
LLM_OPENAI_API_KEY=sk-<your-openai-key>
LLM_OPENAI_BASE_URL=https://api.openai.com/v1
LLM_OPENAI_MODEL=gpt-4o

# Provider: DeepSeek (optional)
# LLM_DEEPSEEK_API_KEY=sk-<your-deepseek-key>
# LLM_DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
# LLM_DEEPSEEK_MODEL=deepseek-chat

# Provider: Qwen / DashScope (optional)
# LLM_QWEN_API_KEY=sk-<your-qwen-key>
# LLM_QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
# LLM_QWEN_MODEL=qwen-plus

# Provider: OneAPI / proxy aggregator (optional)
# LLM_ONEAPI_API_KEY=sk-<your-oneapi-key>
# LLM_ONEAPI_BASE_URL=https://your-oneapi-host/v1
# LLM_ONEAPI_MODEL=gpt-4o,claude-3.5-sonnet

LLM_DEFAULT_PROVIDER=openai

# ============================================================
# Embedding (uses LLM provider API by default)
# ============================================================
EMBEDDING_PROVIDER=openai
EMBEDDING_API_URL=https://api.openai.com/v1
EMBEDDING_API_KEY=sk-<your-embedding-key>
EMBEDDING_MODEL_NAME=text-embedding-3-small
EMBEDDING_DIMENSION=1536

# ============================================================
# Vector Memory (mem0ai)
# ============================================================
MEMORY_PROVIDER=pgvector

# ============================================================
# Document Conversion (Markitdown)
# ============================================================
MARKITDOWN_SERVICE_URL=http://127.0.0.1:6010/v1/convert

# ============================================================
# Invitation
# ============================================================
FIXED_INVITATION_CODE=SIT2024
DEFAULT_INVITATION_SLOTS=5

# ============================================================
# WeTinker Gateway (optional, for enterprise)
# ============================================================
WETINKER_API_BASE_URL=

# ============================================================
# Sandbox (code execution, optional)
# ============================================================
SANDBOX_ENABLED=false
# SANDBOX_SERVER_URL=http://localhost:5002
# SANDBOX_API_KEY=<your-sandbox-key>
# SANDBOX_USE_SERVER_PROXY=false
# SANDBOX_IMAGE=python:3.12-alpine
# SANDBOX_TIMEOUT=300
```

> 完整变量说明见下方 [Full Configuration Reference](#full-configuration-reference)。

## Full Configuration Reference

### Server Environment Variables (`server/.env`)

All configuration lives in `server/.env`. Copy from the template:

```bash
cp server/.env.example server/.env
```

#### Required

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Secret for signing JWT tokens. Generate: `openssl rand -hex 64` |
| `VECTOR_POSTGRES_URL` | PostgreSQL connection: `postgresql://user:pass@host:5432/ainote` |
| `LLM_OPENAI_API_KEY` | At least one LLM provider API key |

#### LLM Providers

Supported providers: OpenAI, DeepSeek, Qwen, OneAPI (proxy aggregator).

```
LLM_OPENAI_API_KEY=sk-xxx
LLM_OPENAI_BASE_URL=https://api.openai.com/v1
LLM_OPENAI_MODEL=gpt-4o
LLM_DEFAULT_PROVIDER=openai
```

Additional providers can be configured with the pattern `LLM_{PROVIDER}_{SETTING}` — see `.env.example` for all options.

#### Database

| Variable | Default | Description |
|----------|---------|-------------|
| `VECTOR_POSTGRES_URL` | — | Full PostgreSQL connection string |

#### Storage

| Variable | Default | Description |
|----------|---------|-------------|
| `STORAGE_PROVIDER` | `local` | `local`, `qiniu`, `oss`, or `s3` |
| `QINIU_ACCESS_KEY` | — | Qiniu access key |
| `QINIU_SECRET_KEY` | — | Qiniu secret key |
| `QINIU_BUCKET` | — | Qiniu bucket name |
| `QINIU_DOMAIN` | — | Qiniu CDN domain |

#### Workflow Engine (Temporal)

| Variable | Default |
|----------|---------|
| `TEMPORAL_SERVER_URL` | `localhost:7233` |
| `TEMPORAL_NAMESPACE` | `default` |
| `TEMPORAL_TASK_QUEUE` | `ainote-workflows` |
| `START_TEMPORAL_WORKER` | `true` |

#### Sandbox (Code Execution)

| Variable | Default | Description |
|----------|---------|-------------|
| `SANDBOX_ENABLED` | `false` | Enable remote code execution |
| `SANDBOX_SERVER_URL` | `localhost:5002` | Sandbox server address |
| `SANDBOX_API_KEY` | — | Authentication key |

See [sandbox setup guide](sandbox/README.md) for deployment instructions.

#### Other

| Variable | Default | Description |
|----------|---------|-------------|
| `CLIENT_ORIGIN` | `http://localhost:5173,http://localhost:8081` | CORS origins (comma-separated) |
| `FIXED_INVITATION_CODE` | `SIT2024` | Registration invitation code |
| `DEFAULT_TOKEN_BALANCE` | `100000` | Initial token balance for new users |
| `EMBEDDING_PROVIDER` | `openai` | Embedding provider |
| `EMBEDDING_MODEL_NAME` | `text-embedding-3-small` | Embedding model |
| `MEMORY_PROVIDER` | `pgvector` | Vector memory backend (uses PostgreSQL pgvector) |
| `MARKITDOWN_SERVICE_URL` | `http://127.0.0.1:6010/v1/convert` | Document conversion endpoint |

## Project Structure

```
ainote/
├── client/                    # React frontend (Vite + Ant Design)
│   └── src/
│       ├── api/               # API client
│       ├── components/        # Shared UI components
│       ├── features/
│       │   ├── form-builder/  # Drag-and-drop form builder (16+ field types)
│       │   ├── views/         # Chart & dashboard view builder
│       │   └── data-management/# Table view, inline editing, Excel import/export
│       ├── pages/
│       │   ├── form/          # Form designer, publish, data management
│       │   ├── public-form/     # Public form sharing & access code
│       │   ├── views/         # View & chart designer
│       │   ├── workflow/      # Visual workflow editor
│       │   └── digital-worker/  # Digital worker (AI agent) chat & management
│       ├── i18n.js            # Internationalization
│       ├── channels/           # Channel integrations (DingTalk, WeTinker, etc.)
│       └── sdk/               # Embeddable SDK (AiNoteChat)
├── server/                    # Node.js/Express backend
│   ├── index.js               # App entry point
│   ├── config/                # Configuration (env, db, logger)
│   ├── routes/                # API routes
│   │   ├── forms/             # Form CRUD, publish, public data API
│   │   ├── channels/             # Gateway channel management (DingTalk, WeTinker)
│   │   ├── digital-workers/   # Digital worker management & streaming chat
│   │   └── workflows/         # Workflow engine API
│   ├── services/              # Business logic services
│   │   └── gateway/            # Gateway service: providers, sessions, monitor
│   ├── controllers/           # Request handlers
│   ├── middleware/             # Express middleware
│   ├── temporal/              # Temporal workflows & activities
│   └── scripts/               # Utility scripts (db init, seeds)
├── python/                    # Markitdown document conversion service
├── docker/                    # PostgreSQL custom image build
├── 1shared/                   # Shared code (client ↔ server)
├── sandbox/                   # OpenSandbox deployment guide
├── docs/                      # Documentation
├── docker-compose.yml         # Full-stack Docker orchestration
└── *.sh                       # Infrastructure start scripts
```

## Development

### Server

```bash
cd server
pnpm run dev         # Start with hot reload (nodemon + tsx)
pnpm run test        # Run tests (vitest)
pnpm run lint        # ESLint
pnpm run format      # Prettier
pnpm run db:push     # Push schema changes to database
```

### Client

```bash
cd client
pnpm run dev         # Start dev server (port 5000)
pnpm run build       # Production build
pnpm run preview     # Preview production build
```

### Viewing Logs

```bash
cat app.1.log | pino-pretty
```

## License

[MIT](LICENSE)
