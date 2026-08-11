import uuid
import logging
import os
from flask import Flask, request, jsonify
from werkzeug.exceptions import RequestEntityTooLarge

# --- 导入自定义模块 ---
# 确保项目结构中包含 config.py, utils.py 和 services/ 文件夹
from config import Config
from utils import check_dependencies, allowed_file, save_upload_file, cleanup_file, download_file
from services.markitdown_converter import MarkItDownProcessor
from services.pandoc_converter import PandocProcessor
from services.pymupdf4llm_converter import PyMuPDFConverter

# 1. 初始化日志配置
# 生产环境日志格式，包含时间、模块名、日志级别
logging.basicConfig(
    level=logging.INFO, 
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("DocService.App")

# 2. 初始化应用配置和检查依赖
# 创建上传目录，检查 Pandoc 是否安装
Config.init_app()
check_dependencies()

# 3. 初始化 Flask 应用
app = Flask(__name__)
# 设置最大上传限制 (默认 60MB)，防止 DoS 攻击
app.config['MAX_CONTENT_LENGTH'] = Config.MAX_CONTENT_LENGTH

# --- 错误处理器 ---

@app.errorhandler(RequestEntityTooLarge)
def handle_file_too_large(e):
    """全局异常捕获：文件超过限制大小"""
    return jsonify({
        'error': 'File is too large', 
        'max_size_bytes': Config.MAX_CONTENT_LENGTH,
        'max_size_mb': Config.MAX_CONTENT_LENGTH / (1024 * 1024)
    }), 413

@app.errorhandler(500)
def handle_internal_error(e):
    """全局异常捕获：服务器内部错误"""
    return jsonify({'error': 'Internal Server Error', 'details': str(e)}), 500

# --- 路由定义 ---

@app.route('/health', methods=['GET'])
def health_check():
    """健康检查接口 (用于 K8s/SLB 探针)"""
    return jsonify({'status': 'ok', 'service': 'DocxConverter'}), 200

@app.route('/v1/convert', methods=['POST'])
def convert_endpoint():
    """
    核心转换接口
    POST /v1/convert
    Form-Data 或 JSON 参数:
      - file: (File) 要转换的文件 (优先)
      - fileUrl: (String) 要下载并转换的文件 URL
      - filename: (String) 配合 fileUrl 使用的文件名
      - nodeId: (String) 可选的业务ID，原样返回
    """
    # 获取参数：兼容 Form-Data 和 JSON
    if request.is_json:
        data = request.json
        node_id = data.get('nodeId', '')
        file_url = data.get('fileUrl')
        input_filename = data.get('filename')
    else:
        node_id = request.form.get('nodeId', '')
        file_url = request.form.get('fileUrl')
        input_filename = request.form.get('filename')
    
    uid = str(uuid.uuid4())
    saved_path = None
    filename = None

    try:
        # 1. 优先处理直接上传的文件 (Form-Data)
        if 'file' in request.files:
            file = request.files['file']
            if file.filename != '':
                if not allowed_file(file.filename):
                    return jsonify({'error': 'Invalid file extension'}), 400
                saved_path, filename = save_upload_file(file, uid)
        
        # 2. 如果没有文件，尝试从 URL 下载
        if not saved_path and file_url:
            if not input_filename:
                return jsonify({'error': 'filename is required when using fileUrl'}), 400
            if not allowed_file(input_filename):
                return jsonify({'error': 'Invalid file extension'}), 400
            
            saved_path, filename = download_file(file_url, uid, input_filename)

        if not saved_path:
            return jsonify({'error': 'No file or fileUrl provided'}), 400

        logger.info(f"Processing file: {filename} (UID: {uid})")
        
        result_data = {}

        # 3. 业务逻辑分发：根据文件后缀选择不同的处理器
        ext = os.path.splitext(filename)[1].lower().lstrip('.')
        result_data = {}

        # Map common extensions to processors/outputs
        pypandoc_like = {'docx', 'odt', 'md', 'markdown', 'html', 'htm'}
        pymupdf_like = {'pdf'}

        if ext in pypandoc_like:
            # Use PandocProcessor to produce HTML (with base64 images)
            processor = PandocProcessor(use_base64_images=True)
            html_content = processor.convert(saved_path)
            result_data = {'content': html_content, 'format': 'html'}
        elif ext in pymupdf_like:
            # Use PyMuPDFConverter to produce Markdown (with base64 images)
            processor = PyMuPDFConverter()
            md_content = processor.convert(saved_path, convert_tables_to_images=True)
            result_data = {'content': md_content, 'format': 'markdown'}
        else:
            processor = MarkItDownProcessor()
            md_content = processor.convert(saved_path)
            result_data = {'content': md_content, 'format': 'markdown'}

        # 4. 构建成功响应
        return jsonify({
            'success': True,
            'originalFilename': filename,
            'nodeId': node_id,
            'uid': uid,
            **result_data
        })

    except Exception as e:
        # 记录详细堆栈日志
        logger.exception("Conversion process failed")
        
        # 返回友好的错误信息给客户端
        return jsonify({
            'success': False, 
            'error': str(e),
            'type': type(e).__name__
        }), 500
        
    finally:
        # 5. 资源清理 (至关重要)
        # 无论转换成功还是失败，都必须删除上传的临时文件，防止磁盘爆满
        if saved_path:
            cleanup_file(saved_path)

# --- 启动入口 ---

if __name__ == '__main__':
    # 获取环境变量中的 Host 和 Port 配置
    # 默认为 0.0.0.0 以允许外部访问 (Docker/局域网)
    host = os.environ.get('HOST', '0.0.0.0')
    port = int(os.environ.get('PORT', 5002))

    logger.info(f"🚀 Starting DocService server on http://{host}:{port}")
    
    # 启动 Flask 开发服务器
    # 注意：生产环境建议使用 Gunicorn 启动: 
    # gunicorn -w 4 -b 0.0.0.0:6010 app:app --timeout 120
    app.run(host=host, port=port, debug=False)