import os
import time
from pathlib import Path
from typing import Set, Dict

# ====================================================================
# CẤU HÌNH BỘ LỌC CHUẨN HOÁ CHO DỰ ÁN TOÀN DIỆN (BACKEND & STOREFRONT)
# ====================================================================

OUTPUT_FILE = "all_project_code.txt"

# Các thư mục hệ thống hoặc build cần bỏ qua hoàn toàn
EXCLUDE_DIRS: Set[str] = {
    'node_modules', '.git', '.vscode', '.idea', 'dist', 'build', 
    '__pycache__', '.next', 'out', 'venv', 'env', 'coverage', '.cache'
}

# Các file rác hoặc file khóa thư viện không cần đưa vào ngữ cảnh AI
EXCLUDE_FILES: Set[str] = {
    OUTPUT_FILE, 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
    '.DS_Store', 'pack_project.py', 'pack.py', 'pnpm-workspace.yaml'
}

# Hỗ trợ toàn bộ đuôi file full-stack mới (Backend Node.js/Python + Frontend React/Next.js)
ALLOWED_EXTENSIONS: Set[str] = {
    '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', 
    '.json', '.html', '.css', '.scss', '.py', '.sql', 
    '.md', '.yaml', '.yml'
}

# Các file cấu hình đặc biệt không có extension hoặc bắt đầu bằng dấu chấm
ALLOWED_SPECIAL_FILES: Set[str] = {
    'Dockerfile', 'dockerfile', '.gitignore', 'Makefile'
}

# Giới hạn dung lượng file đơn lẻ (Tránh gom nhầm file log lớn hoặc data dump làm tràn bộ nhớ AI)
MAX_FILE_SIZE_KB = 500  


def generate_ascii_tree(dir_path: Path, prefix: str = "", is_last: bool = True) -> str:
    """Tự động dựng bản đồ cây thư mục trực quan trực tiếp vào đầu file text"""
    if dir_path.name in EXCLUDE_DIRS or dir_path.name.startswith('.'):
        return ""
    
    tree_str = prefix + ("└── " if is_last else "├── ") + dir_path.name + "/\n"
    prefix += "    " if is_last else "│   "
    
    try:
        # Lọc và sắp xếp thư mục trước, file sau
        entries = sorted(list(dir_path.iterdir()), key=lambda p: (p.is_file(), p.name.lower()))
        visible_entries = []
        
        for entry in entries:
            if entry.is_dir():
                if entry.name not in EXCLUDE_DIRS and not entry.name.startswith('.'):
                    visible_entries.append(entry)
            else:
                if entry.name not in EXCLUDE_FILES:
                    # Kiểm tra đuôi file hợp lệ hoặc file đặc biệt/env
                    if entry.suffix.lower() in ALLOWED_EXTENSIONS or \
                       entry.name in ALLOWED_SPECIAL_FILES or \
                       entry.name.startswith('.env'):
                        visible_entries.append(entry)
                        
        count = len(visible_entries)
        for i, entry in enumerate(visible_entries):
            last_entry = (i == count - 1)
            if entry.is_dir():
                tree_str += generate_ascii_tree(entry, prefix, last_entry)
            else:
                tree_str += prefix + ("└── " if last_entry else "├── ") + entry.name + "\n"
    except Exception:
        pass
    return tree_str


def pack_project_to_text():
    start_time = time.time()
    project_root = Path.cwd()
    
    print(f"🚀 Bắt đầu quét & đóng gói hệ thống cấu trúc mới tại: {project_root}")
    print(f"📦 Nhận diện tích hợp phân hệ song song: 'backend/' và 'storefront/'")
    
    stats_count = 0
    stats_by_ext: Dict[str, int] = {}
    skipped_large_files = []

    with open(OUTPUT_FILE, "w", encoding="utf-8", errors="replace") as outfile:
        # 1. TIÊU ĐỀ VÀ TỰ ĐỘNG CHÈN SƠ ĐỒ CÂY THƯ MỤC KHỞI TẠO
        outfile.write("=== TỔNG HỢP MÃ NGUỒN DỰ ÁN (BẢN NÂNG CẤP TOÀN DIỆN) ===\n")
        outfile.write(f"Thư mục gốc: {project_root}\n")
        outfile.write(f"Thời gian khởi tạo: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
        outfile.write("=" * 60 + "\n\n")
        
        outfile.write("📸 SƠ ĐỒ CÂY THƯ MỤC TRỰC QUAN TOÀN HỆ THỐNG:\n")
        outfile.write(".\n")
        
        # Quét tầng đầu tiên để sinh cây thư mục chuẩn hóa
        top_entries = sorted([p for p in project_root.iterdir() if p.is_dir() and p.name not in EXCLUDE_DIRS and not p.name.startswith('.')])
        for i, top_dir in enumerate(top_entries):
            is_last = (i == len(top_entries) - 1)
            outfile.write(generate_ascii_tree(top_dir, prefix="", is_last=is_last))
        outfile.write("=" * 60 + "\n\n")

        # 2. DUYỆT ĐỌC NỘI DUNG FILE CHUYÊN SÂU
        for root, dirs, files in os.walk(project_root):
            current_dir = Path(root)
            
            # Loại bỏ thư mục ẩn và thư mục loại trừ để tối ưu hiệu năng vòng lặp walk
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.startswith('.')]
            
            for file_name in sorted(files):
                if file_name in EXCLUDE_FILES:
                    continue
                    
                file_path = current_dir / file_name
                
                # Bỏ qua file ẩn (trừ file môi trường .env hoặc file đặc biệt)
                if file_name.startswith('.') and not file_name.startswith('.env') and file_name not in ALLOWED_SPECIAL_FILES:
                    continue
                
                ext = file_path.suffix.lower()
                
                # Điều kiện kiểm duyệt file
                is_allowed = (ext in ALLOWED_EXTENSIONS) or \
                             (file_name in ALLOWED_SPECIAL_FILES) or \
                             (file_name.startswith('.env'))
                             
                if is_allowed:
                    # Kiểm tra an toàn kích thước file chống tràn ngữ cảnh vô nghĩa
                    file_size_kb = file_path.stat().st_size / 1024
                    if file_size_kb > MAX_FILE_SIZE_KB:
                        skipped_large_files.append(f"{file_path.name} ({file_size_kb:.1f} KB)")
                        continue
                    
                    # Chuẩn hóa đường dẫn tương đối theo định dạng Unix (dấu /)
                    relative_path = file_path.relative_to(project_root)
                    standardized_path = str(relative_path).replace(os.sep, '/')
                    
                    try:
                        # Sử dụng errors='replace' để tránh crash script giữa chừng khi file có ký tự đặc biệt
                        with open(file_path, "r", encoding="utf-8", errors="replace") as infile:
                            content = infile.read()
                        
                        # Ghi cấu trúc phân tách dữ liệu rõ ràng cho AI
                        outfile.write(f"// FILE_PATH: {standardized_path}\n")
                        outfile.write(f"// START_OF_FILE\n")
                        outfile.write(content)
                        if not content.endswith('\n'):
                            outfile.write("\n")
                        outfile.write(f"// END_OF_FILE\n")
                        outfile.write("-" * 60 + "\n\n")
                        
                        print(f"✔ Đã nạp: {standardized_path}")
                        stats_count += 1
                        
                        # Thống kê phân loại dữ liệu phục vụ báo cáo
                        key_ext = ext if ext else file_name
                        stats_by_ext[key_ext] = stats_by_ext.get(key_ext, 0) + 1
                        
                    except Exception as e:
                        print(f"❌ Lỗi không thể đọc file: {standardized_path} (Lỗi: {e})")

        # 3. GHI BÁO CÁO THỐNG KÊ Ở CUỐI FILE TEXT
        outfile.write("=== BÁO CÁO ĐÓNG GÓI THÀNH CÔNG ===\n")
        outfile.write(f"Tổng số lượng file đã gom: {stats_count}\n")
        outfile.write("Phân bố chi tiết theo loại file:\n")
        for ext_name, count in sorted(stats_by_ext.items(), key=lambda x: x[1], reverse=True):
            outfile.write(f"  - {ext_name}: {count} files\n")
        if skipped_large_files:
            outfile.write(f"⚠️ Đã bỏ qua các file quá lớn (> {MAX_FILE_SIZE_KB}KB):\n")
            for f in skipped_large_files:
                outfile.write(f"  - {f}\n")
        outfile.write(f"Thời gian xử lý: {time.time() - start_time:.2f} giây\n")

    print(f"\n🎉 Hoàn thành xuất sắc! Cấu trúc thư mục mới đã được đồng bộ hóa thành công.")
    print(f"📊 Đã gom {stats_count} files sạch sẽ vào siêu văn bản '{OUTPUT_FILE}'.")
    if skipped_large_files:
        print(f"⚠️ Lưu ý: Có {len(skipped_large_files)} file kích thước lớn bị bỏ qua để bảo vệ bộ nhớ Token.")

if __name__ == "__main__":
    pack_project_to_text()