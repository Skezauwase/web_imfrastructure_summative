#!/bin/bash
# ============================================================
#  ResearchRadar — Web Server Setup Script
#  Run this on BOTH Web01 (54.166.88.241) and Web02 (3.80.189.90)
#  Usage: bash deploy-web.sh
# ============================================================

set -e  # Exit on any error

APP_DIR="/var/www/researchradar"
REPO_URL="https://github.com/YOUR_USERNAME/YOUR_REPO.git"  # <-- update this
APP_PORT=3000

echo "===> Updating system packages..."
sudo apt-get update -y

echo "===> Installing Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "===> Installing Nginx..."
sudo apt-get install -y nginx

echo "===> Installing PM2 (process manager)..."
sudo npm install -g pm2

echo "===> Cloning / updating app..."
if [ -d "$APP_DIR" ]; then
    cd "$APP_DIR"
    git pull origin main
else
    sudo git clone "$REPO_URL" "$APP_DIR"
    sudo chown -R ubuntu:ubuntu "$APP_DIR"
    cd "$APP_DIR"
fi

echo "===> Installing app dependencies..."
cd "$APP_DIR/researchradar"
npm install --production

echo "===> Starting app with PM2..."
pm2 stop researchradar 2>/dev/null || true
pm2 start server.js --name researchradar --env production
pm2 save
pm2 startup | tail -1 | sudo bash

echo "===> Configuring Nginx reverse proxy..."
sudo tee /etc/nginx/sites-available/researchradar > /dev/null <<'NGINX'
server {
    listen 80 default_server;
    server_name _;

    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 10s;
        proxy_send_timeout    30s;
        proxy_read_timeout    30s;
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/researchradar /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
sudo systemctl enable nginx

echo ""
echo "===> Done! App is running at http://$(curl -s ifconfig.me)"
echo "     PM2 status:"
pm2 list
