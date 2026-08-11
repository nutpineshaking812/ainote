import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # 基础配置
    UPLOAD_DIR = os.environ.get('UPLOAD_DIR', '/tmp/doc_service_uploads')
    
    # 文件大小限制 (默认 60MB)
    MAX_CONTENT_LENGTH = int(os.environ.get('MAX_CONTENT_LENGTH', 60 * 1024 * 1024))
    
    # 允许的文件扩展名
    ALLOWED_EXTENSIONS = {'docx', 'document', 'md', 'markdown', 'txt', 'pdf', 'html', 'xlsx', 'pptx'}
    
    # 服务端口
    PORT = int(os.environ.get('PORT', 6010))

    # 确保上传目录存在
    @staticmethod
    def init_app():
        os.makedirs(Config.UPLOAD_DIR, exist_ok=True)