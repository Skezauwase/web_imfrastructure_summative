#!/bin/bash
# ============================================================
#  ResearchRadar — Load Balancer Setup Script
#  Run this on Lb01 (13.218.49.63 / lb-01.skeza.tech)
#  Usage: bash deploy-lb.sh
# ============================================================

set -e

WEB01="54.166.88.241"
WEB02="3.80.189.90"
DOMAIN="lb-01.skeza.tech"

echo "===> Updating system packages..."
sudo apt-get update -y

echo "===> Installing Nginx..."
sudo apt-get install -y nginx

echo "===> Configuring Nginx load balancer for ${DOMAIN}..."
sudo tee /etc/nginx/sites-available/researchradar-lb > /dev/null <<NGINX
upstream researchradar_backend {
    server ${WEB01}:80;
    server ${WEB02}:80;
}

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${DOMAIN} www.${DOMAIN} 13.218.49.63;

    location / {
        proxy_pass         http://researchradar_backend;
        proxy_http_version 1.1;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;

        # Failover: if one backend is down, try the other
        proxy_next_upstream error timeout http_500 http_502 http_503;
        proxy_connect_timeout 5s;
        proxy_read_timeout    30s;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "ok\n";
        add_header Content-Type text/plain;
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/researchradar-lb /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
sudo systemctl enable nginx

echo ""
echo "===> Load balancer is ready!"
echo "     http://${DOMAIN}"
echo "     http://13.218.49.63"
echo ""
echo "===> Testing backend servers..."
echo -n "     Web01 (${WEB01}): "
curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://${WEB01}" || echo "unreachable"
echo ""
echo -n "     Web02 (${WEB02}): "
curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://${WEB02}" || echo "unreachable"
echo ""
echo "===> Nginx status:"
sudo systemctl status nginx --no-pager
