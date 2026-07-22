"""
AI Service Authentication Middleware
Xác thực nội bộ giữa Backend và AI Service
"""

from fastapi import HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import os

security = HTTPBearer()

def get_ai_internal_secret() -> str:
    """Lấy AI_INTERNAL_SECRET từ environment"""
    secret = os.getenv("AI_INTERNAL_SECRET", "")
    if not secret:
        raise HTTPException(
            status_code=500,
            detail="Lỗi cấu hình: AI_INTERNAL_SECRET chưa được thiết lập!"
        )
    return secret

def require_ai_auth(credentials: HTTPAuthorizationCredentials = Security(security)):
    """
    Middleware xác thực yêu cầu từ AI Service
    Sử dụng Shared Secret để xác thực
    """
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Yêu cầu xác thực. Thiếu Authorization header!"
        )
    
    expected_secret = get_ai_internal_secret()
    
    if credentials.credentials != expected_secret:
        # Log attempt (trong production nên dùng proper logging)
        print(f"[aiAuth] Invalid AI service token attempt")
        raise HTTPException(
            status_code=403,
            detail="Truy cập bị từ chối. Token xác thực AI Service không hợp lệ!"
        )
    
    return True