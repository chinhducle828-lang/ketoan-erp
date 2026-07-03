import os

# Tên file text đầu ra
OUTPUT_FILE = "all_project_code.txt"

# Danh sách các thư mục và file cần BỎ QUA
EXCLUDE_DIRS = {
    'node_modules', '.git', '.vscode', 'dist', 'build', 
    '__pycache__', '.next', 'out', 'venv', 'env'
}
EXCLUDE_FILES = {
    OUTPUT_FILE, 'package-lock.json', 'yarn.lock', 
    '.DS_Store', 'pack_project.py'
}

# Danh sách các định dạng file muốn GOM
ALLOWED_EXTENSIONS = {
    '.js', '.jsx', '.ts', '.tsx', '.json', '.html', 
    '.css', '.py', '.sql', '.env', '.md'
}

def pack_project_to_text():
    project_root = os.getcwd()
    print(f"🚀 Bắt đầu quét và chuẩn hóa cây thư mục tại: {project_root}\n")
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as outfile:
        outfile.write(f"=== TỔNG HỢP MÃ NGUỒN DỰ ÁN ===\n")
        outfile.write(f"Thư mục gốc: {project_root}\n")
        outfile.write("=" * 40 + "\n\n")
        
        count = 0
        for root, dirs, files in os.walk(project_root):
            # Loại bỏ các thư mục ẩn và thư mục loại trừ
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.startswith('.')]
            
            for file in files:
                if file in EXCLUDE_FILES or file.startswith('.'):
                    continue
                    
                file_path = os.path.join(root, file)
                # Lấy đường dẫn tương đối
                relative_path = os.path.relpath(file_path, project_root)
                
                # CHUẨN HÓA: Ép buộc tất cả dấu hệ điều hành (kể cả Windows \) thành dấu / của VS Code
                standardized_path = relative_path.replace(os.sep, '/')
                
                _, ext = os.path.splitext(file)
                if ext.lower() in ALLOWED_EXTENSIONS or file == '.env':
                    try:
                        with open(file_path, "r", encoding="utf-8") as infile:
                            content = infile.read()
                            
                        # Ghi log đường dẫn đã chuẩn hóa tuyệt đối
                        outfile.write(f"// FILE_PATH: {standardized_path}\n")
                        outfile.write(f"// START_OF_FILE\n")
                        outfile.write(content)
                        outfile.write(f"\n// END_OF_FILE\n")
                        outfile.write("-" * 60 + "\n\n")
                        
                        print(f"✔ Đã hạch toán cây thư mục chuẩn: {standardized_path}")
                        count += 1
                    except Exception as e:
                        print(f"❌ Không thể đọc file: {standardized_path} (Lỗi: {e})")
                        
    print(f"\n🎉 Hoàn thành! Cây thư mục đã chuẩn xác 100%. Đã gom {count} files vào '{OUTPUT_FILE}'")

if __name__ == "__main__":
    pack_project_to_text()