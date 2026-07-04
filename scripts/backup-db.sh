#!/bin/bash
# ============================================================
# Script Backup Database PostgreSQL - ERP Kế toán
# Tự động backup định kỳ, lưu trữ 30 ngày gần nhất
# ============================================================

set -e

# Cấu hình
BACKUP_DIR="/backup/ketoan"
DB_NAME="${DB_NAME:-ketoan}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/ketoan_${TIMESTAMP}.sql.gz"
LOG_FILE="${BACKUP_DIR}/backup.log"

# Màu sắc cho output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Hàm ghi log
log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Hàm kiểm tra lỗi
check_error() {
    if [ $? -ne 0 ]; then
        log "${RED}LỖI: $1${NC}"
        exit 1
    fi
}

# Tạo thư mục backup nếu chưa tồn tại
mkdir -p "$BACKUP_DIR"
check_error "Không thể tạo thư mục backup $BACKUP_DIR"

log "${GREEN}=== BẮT ĐẦU BACKUP DATABASE ===${NC}"
log "Database: $DB_NAME"
log "Host: $DB_HOST:$DB_PORT"
log "Backup file: $BACKUP_FILE"

# Kiểm tra kết nối database
log "Kiểm tra kết nối database..."
PGPASSWORD="${DB_PASSWORD}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1
check_error "Không thể kết nối đến database $DB_NAME"

# Thực hiện backup
log "Đang thực hiện backup..."
PGPASSWORD="${DB_PASSWORD}" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --format=custom \
    --verbose \
    --no-owner \
    --no-acl \
    2>> "$LOG_FILE" | gzip > "$BACKUP_FILE"

check_error "Backup thất bại"

# Kiểm tra file backup
if [ -f "$BACKUP_FILE" ]; then
    FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    log "${GREEN}Backup thành công!${NC}"
    log "Kích thước file: $FILE_SIZE"
else
    log "${RED}LỖI: File backup không được tạo${NC}"
    exit 1
fi

# Xóa các bản backup cũ hơn RETENTION_DAYS
log "Dọn dẹp các bản backup cũ hơn $RETENTION_DAYS ngày..."
find "$BACKUP_DIR" -name "ketoan_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete
check_error "Không thể dọn dẹp backup cũ"

# Đếm số lượng backup còn lại
BACKUP_COUNT=$(find "$BACKUP_DIR" -name "ketoan_*.sql.gz" -type f | wc -l)
log "Số lượng backup hiện tại: $BACKUP_COUNT"

# Tạo symbolic link đến bản backup mới nhất
ln -sf "$BACKUP_FILE" "${BACKUP_DIR}/latest.sql.gz"
log "Đã cập nhật symbolic link: latest.sql.gz"

log "${GREEN}=== HOÀN TẤT BACKUP ===${NC}"
log "Backup file: $BACKUP_FILE"
log "Kích thước: $FILE_SIZE"
log "Số lượng backup: $BACKUP_COUNT"

# Thông tin dung lượng
echo ""
echo "=== THỐNG KÊ DUNG LƯỢNG ==="
du -sh "$BACKUP_DIR"/*.sql.gz | sort -rh | head -5

exit 0