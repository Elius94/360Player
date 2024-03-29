module.exports = {
    apps: [{
        name: "immersive",
        script: "serve",
        env: {
            PM2_SERVE_PATH: '/opt/web/srv.eliusoutdoor.com/360Player/public',
            PM2_SERVE_PORT: 3002,
            PM2_SERVE_SPA: 'true'
        }
    }],
    deploy: {
        production: {
            user: 'root',
            host: '194.163.139.154',
            key: 'deploy.key',
            ref: 'origin/master',
            repo: 'https://github.com/Elius94/360Player',
            path: '/opt/web/srv.eliusoutdoor.com/360Player',
            'pre-deploy': 'git fetch --all',
            'post-deploy':
                'source /root/.bashrc && npm install && npm run build && pm2 reload immersive && pm2 save ',
            env: {

            },
        },
    },
}