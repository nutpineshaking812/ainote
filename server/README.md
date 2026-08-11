# Server

AINote platform backend. Build AI agent workflows, orchestrate digital employees, and manage knowledge bases.

## Prerequisites

- Node.js 20+
- pnpm
- PostgreSQL 16 with pgvector extension
- Temporal Server (for workflow orchestration)
- Python service (for document conversion)

## Quick Start (Docker)

```bash
# From project root
docker compose up -d
```

This starts PostgreSQL, Temporal, backend, frontend, and Python service. Temporal UI is optional (`--profile debug`).

## Manual Setup

```bash
cp .env.example .env       # Edit with your API keys
pnpm install
pnpm dev                   # Starts on port 5001
```

## Environment Variables

See `.env.example` for a complete list. At minimum you need:

- `JWT_SECRET` — generate with `openssl rand -hex 64`
- `LLM_OPENAI_API_KEY` — your OpenAI or compatible LLM API key
- `VECTOR_POSTGRES_URL` — PostgreSQL connection string
- `TEMPORAL_SERVER_URL` — Temporal Server address

## Architecture

```
server/
├── config/         Environment & logger configuration
├── db/             Drizzle ORM schema & migrations
├── middleware/     Express middleware (auth, permissions, etc.)
├── registry/       System workflows & digital employee presets
├── repositories/    Data access layer
├── routes/         REST API routes
├── schemas/        Request/response validation schemas
├── services/       Business logic layer
├── temporal/       Temporal workflows & activities
├── utils/          Shared utilities
└── index.js        Entry point
```

## Database Setup

```bash
# Initialize PostgreSQL extensions (pgvector, zhparser, AGE)
pnpm setup-db
```

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start development server |
| `pnpm start` | Start production server |
| `pnpm setup-db` | Initialize PostgreSQL extensions |
| `pnpm seed:workflows` | Seed system workflows |
| `pnpm seed:employees -- --appId=<id>` | Seed preset digital employees |

## Testing

```bash
pnpm test
```

## License

MIT
