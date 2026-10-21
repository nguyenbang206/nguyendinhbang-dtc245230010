# Các bước thực hiện

1. Dựng web Node.js + MySQL + nginx bằng Docker Compose
2. Cấu hình HTTPS cho nginx (scripts/gen-certs.sh)
3. Thêm giám sát: Prometheus, node-exporter, cAdvisor, mysql-exporter
4. Thêm log: Loki + Promtail
5. Tạo dashboard Grafana tổng hợp (grafana/dashboards)
6. Kiểm tra bằng scripts/check-targets.sh
