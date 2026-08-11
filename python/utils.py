import os
import logging
import requests
from werkzeug.utils import secure_filename
from config import Config

logger = logging.getLogger("DocService.Utils")

def check_dependencies():
    """检查并下载必要的依赖"""
    try:
        import pypandoc
        from pypandoc.pandoc_download import download_pandoc
        try:
            pypandoc.get_pandoc_version()
        except OSError:
            logger.info("Pandoc binary not found, attempting download...")
            download_pandoc()
            logger.info("Pandoc download complete.")
    except ImportError:
        logger.warning("pypandoc module not found. HTML conversion may fail.")

def allowed_file(filename):
    """检查文件扩展名是否合法"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS

def save_upload_file(file, uid):
    """保存上传的文件到临时目录"""
    filename = secure_filename(file.filename)
    saved_filename = f"{uid}_{filename}"
    saved_path = os.path.join(Config.UPLOAD_DIR, saved_filename)
    file.save(saved_path)
    return saved_path, filename

def cleanup_file(path):
    """安全删除文件"""
    if path and os.path.exists(path):
        try:
            os.remove(path)
            logger.info(f"Cleaned up: {path}")
        except Exception as e:
            logger.error(f"Failed to cleanup {path}: {e}")

def download_file(url, uid, original_filename):
    """从 URL 下载文件到临时目录"""
    filename = secure_filename(original_filename)
    saved_filename = f"{uid}_{filename}"
    saved_path = os.path.join(Config.UPLOAD_DIR, saved_filename)
    
    logger.info(f"Downloading file from URL: {url}")
    
    response = requests.get(url, stream=True, timeout=60)
    response.raise_for_status()
    
    with open(saved_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
            
    return saved_path, filename