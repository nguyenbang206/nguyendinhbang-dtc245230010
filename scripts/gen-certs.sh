#!/bin/bash
set -e

# Tao chung chi HTTPS tu ky cho Nginx
mkdir -p nginx/certs

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/certs/server.key \
  -out nginx/certs/server.crt \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

# Phan quyen bao ve khoa rieng
chmod 600 nginx/certs/server.key
chmod 644 nginx/certs/server.crt

echo "Da tao chung chi HTTPS thanh cong"
