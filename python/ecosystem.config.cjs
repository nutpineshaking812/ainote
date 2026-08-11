module.exports = {
  apps: [{
    name: 'doc-converter',
    script: 'gunicorn',
    args: '-w 2 -b 0.0.0.0:5002 --timeout 120 app:app',
    interpreter: 'python3',
    // 环境变量
    env: {
      NODE_ENV: 'production',
      PORT: 5002,
      PYTHONPATH: '.',
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    max_memory_restart: '800M',
    autorestart: true,
  }]
};
