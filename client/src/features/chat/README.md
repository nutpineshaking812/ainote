# Chat Feature Module

This module encapsulates reusable chat UI and state logic (conversation list, messages, streaming send) for multiple AI scenarios.

## Components / Hooks

1. `ChatProvider`
   - Props: `requestPath`, `scenario?`, `placeholderKey`, `loadThreadsFn?`
   - Combines `useConversationHistory` (persistent history) with `useXAgentChat` (SSE streaming) and exposes merged messages.
   - Automatically persists streaming messages into history when the stream completes.
   - Supports custom conversation list loading via `loadThreadsFn` for scenario-specific sources.

2. `ChatMessageList`
   - Existing message renderer (presentational).

## Scenario Isolation

Each scenario mounts its own `ChatProvider` instance. Internal state (threads, messagesMap, stream state) is not shared across providers, preventing data leakage when multiple chat scenarios co-exist on the same page.

## Custom Conversation Loading

Pass a `loadThreadsFn` that returns an array of conversation objects (`[{ id, title, updatedAt }]`). The provider maps these into the UI thread model. If omitted, default backend API (`listConversations`) is used.

Example:

```jsx
<ChatProvider
  requestPath={`/ai/chat/${appId}/stream`}
  scenario="insight_analysis"
  placeholderKey="insight-thread"
  loadThreadsFn={async () => fetchCustomConvs(appId)}
></ChatProvider>
```

## Stream Persistence Flow

1. User sends text => `startStream` begins SSE.
2. Incoming chunks accumulate in `streamMessages`.
3. When `streamLoading` flips false, provider merges all chunks into history via `appendMessageToKey` and clears the streaming buffer.

## Extending

- To add new UI around messages, supply a `renderAboveMessages` function.
- For additional per-message decoration, modify / extend `ChatMessageList`.

## Notes

Ensure styling coexistence: The workspace container uses class names prefixed with `chat-` to avoid collision with existing `ai-` styles from legacy pages.
