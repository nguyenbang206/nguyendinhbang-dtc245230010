# HỆ THỐNG QUẢN LÝ SINH VIÊN

Bài tập lớn học phần **Triển khai và Quản trị Hệ thống Phần mềm** (Đề 2).

## 1. Thông tin sinh viên

- Họ và tên: Nguyễn Đình Bằng
- Mã sinh viên: DTC245230010
- Lớp: HTTT – K23A
- Trường: Đại học Công nghệ Thông tin và Truyền thông
- Giảng viên hướng dẫn: ThS. Hoàng Văn Tâm

## 2. Giới thiệu

Website quản lý sinh viên (CRUD sinh viên, lớp, điểm số) triển khai hoàn toàn bằng Docker Compose, tích hợp reverse proxy, giám sát, log tập trung và hardening.

Ba vai trò (RBAC):

| Vai trò | Quyền |
|---|---|
| Admin | Quản lý tài khoản, lớp, sinh viên, điểm |
| Giảng viên | Xem sinh viên lớp phụ trách, chấm điểm trong phạm vi lớp |
| Sinh viên | Xem thông tin và điểm của chính mình |

## 3. Công nghệ sử dụng

| Nhóm | Công nghệ |
|---|---|
| Ứng dụng | Node.js 20, Express, JWT, bcryptjs |
| Cơ sở dữ liệu | MySQL 8.0, phpMyAdmin |
| Reverse proxy | Nginx (HTTPS tự ký, security headers, rate limit) |
| Giám sát | Prometheus, Grafana, cAdvisor, Node Exporter, MySQL Exporter |
| Log tập trung | Loki, Promtail (truy vấn bằng LogQL) |
| Đóng gói | Docker, Docker Compose |

## 4. Cấu trúc thư mục

| Thư mục / tệp | Nội dung |
|---|---|
| app/ | Mã nguồn Node.js, Express và giao diện |
| db/init/ | Script khởi tạo MySQL |
| nginx/ | Cấu hình reverse proxy, chứng chỉ HTTPS |
| monitoring/ | Cấu hình Prometheus |
| grafana/ | Provisioning nguồn dữ liệu, dashboard |
| logging/ | Cấu hình Loki, Promtail |
| scripts/ | Script hỗ trợ (tạo chứng chỉ) |
| docker-compose.yml | Dịch vụ chính |
| docker-compose.monitoring.yml | Dịch vụ giám sát |
| docker-compose.logging.yml | Dịch vụ log |

## 5. Hướng dẫn chạy

Yêu cầu: Ubuntu có Docker và Docker Compose.

```bash
# 1. Clone mã nguồn
git clone https://github.com/nguyenbang206/nguyendinhbang-dtc245230010.git
cd nguyendinhbang-dtc245230010

# 2. Tạo tệp môi trường và đặt mật khẩu mạnh
cp .env.example .env
nano .env

# 3. Tạo chứng chỉ HTTPS tự ký
bash scripts/gen-certs.sh

# 4. Khởi chạy toàn bộ hệ thống
docker compose -f docker-compose.yml \
  -f docker-compose.monitoring.yml \
  -f docker-compose.logging.yml up -d --build

# 5. Kiểm tra trạng thái
docker ps
```

## 6. Địa chỉ truy cập

| Dịch vụ | Địa chỉ |
|---|---|
| Website (HTTPS) | https://192.168.186.129:8443 |
| Website (HTTP, chuyển hướng 301) | http://192.168.186.129:8084 |
| phpMyAdmin | http://192.168.186.129:8085 |
| Grafana | http://192.168.186.129:3001 |
| Prometheus | http://192.168.186.129:9091 |
| Loki | http://192.168.186.129:3101 |

Thay `192.168.186.129` bằng địa chỉ IP máy chạy hệ thống. Trình duyệt sẽ cảnh báo "Not secure" do chứng chỉ tự ký, chọn tiếp tục truy cập.

## 7. Truy vấn LogQL mẫu (Grafana → Explore → Loki)

- `{job="docker"}`
- `{job="docker"} |= "HTTP/1.1"`
- `{job="docker"} |= "HTTP/1.1" |~ "(401|403)"`
- `sum(count_over_time({job="docker"} |= "HTTP/1.1" [5m]))`

## 8. Biện pháp hardening

- Container không chạy root (nginx-unprivileged), `no-new-privileges`, hệ thống tệp chỉ đọc, `cap_drop`.
- Cách ly mạng Docker (backend, monitoring); MySQL và ứng dụng không công bố cổng ra ngoài.
- Tài khoản MySQL riêng cho ứng dụng và exporter, không dùng root.
- Mật khẩu băm bcrypt; `.env` và khóa riêng HTTPS không đưa vào Git.
- HTTPS (TLS 1.2/1.3), security headers, giới hạn tần suất yêu cầu, chặn `/metrics` từ bên ngoài.
- JWT lưu cookie HttpOnly, Secure; phân quyền RBAC ở tầng API.

## 9. Lịch sử commit

| Commit | Nội dung |
|---|---|
| Commit 1 | Triển khai ứng dụng, MySQL và Nginx HTTPS |
| Commit 2 | Thêm Prometheus và Grafana |
| Commit 3 | Thêm Loki và Promtail |
