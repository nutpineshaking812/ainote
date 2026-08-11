module.exports = {
  apps: [
    {
      name: 'ainote-api',
      script: './index.js',
      exec_mode: 'cluster',
      instances: 2,
      env: {
        NODE_ENV: 'production',
        START_TEMPORAL_WORKER: 'false',
        GATEWAY_STANDALONE: 'true',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '500M',
      watch: false,
      autorestart: true,
    },
    {
      name: 'ainote-worker',
      script: './temporal/worker.js',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        IS_TEMPORAL_WORKER: 'true',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '500M',
      watch: false,
      autorestart: true,
    },
    {
      name: 'ainote-gateway',
      script: './gateway.js',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        GATEWAY_STANDALONE: 'true',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '300M',
      watch: false,
      autorestart: true,
    },
  ],
};
