export const BaseAgentState = {
  messages: { value: (x, y) => x.concat(y), default: () => [] },
  userId: { value: (x, y) => y ?? x, default: () => null },
  appId: { value: (x, y) => y ?? x, default: () => null },
  taskId: { value: (x, y) => y ?? x, default: () => null },
};
