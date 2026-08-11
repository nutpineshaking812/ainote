module.exports = {
  apps: [
    {
      name: 'temporal-dev-server',
      // Start Temporal in dev mode using the SQLite database
      // We explicitly set the UI port to 8233 and bind gRPC to 0.0.0.0 for remote access
      // Note: In production, you might want to restrict access or use a full Temporal cluster
      script: 'temporal',
      args: 'server start-dev --ui-port 8233 --ip 0.0.0.0 --db-filename ./temporal.db',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      autorestart: true,
      max_memory_restart: '1G',
      env: {
        TEMPORAL_CLI_SHOW_STACKS: 'true',
      },
    },
  ],
};