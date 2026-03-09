module.exports = {
  apps: [
    {
      name: 'lesi-edu-model',
      cwd: '/www/wwwroot/lesi-edu-model',
      script: 'dist/index.js',
      interpreter: 'node',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      kill_timeout: 5000,
      listen_timeout: 10000,
      restart_delay: 2000,
      env: {
        NODE_ENV: 'production',
        PORT: 3006
      },
      error_file: '/www/wwwroot/lesi-edu-model/logs/pm2-error.log',
      out_file: '/www/wwwroot/lesi-edu-model/logs/pm2-out.log',
      log_file: '/www/wwwroot/lesi-edu-model/logs/pm2-combined.log',
      time: true
    }
  ]
};
