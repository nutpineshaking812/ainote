# 1shared

Isomorphic shared modules for both client (Vite) and server (Node).

Guidelines:
- Keep modules browser-safe (no Node-only APIs) unless placed under a server-only export.
- Use ESM (type: module) to allow direct imports in client and server.
- Prefer small, focused utilities, constants, and schemas.

Exports:
- `@ainote/shared/utils/content`
- `@ainote/shared/constants/events`
- `@ainote/shared/schemas/messages`
- `@ainote/shared/blocknote`

Usage examples:
- Client: `import { blocksToPlain } from '../../1shared/utils/content.js';`
- Server: `import { blocksToPlain } from '../1shared/utils/content.js';` (or set up alias/workspaces)
