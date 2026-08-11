# MarkItDown API 服务

这是一个基于 [Microsoft MarkItDown](https://github.com/microsoft/markitdown) 构建的轻量级文档转换 API 服务。它允许用户上传各种格式的文档（PDF, Word, Excel, PPT 等），并将其转换为干净的 Markdown 文本。

该服务基于 Flask 框架开发，专为生产环境设计，支持 WSGI 部署。

## ✨ 功能特性

- **多格式支持**：支持转换 `.pdf`, `.docx`, `.pptx`, `.xlsx`, `.html`, `.txt`, `.md` 等格式。
- **纯净输出**：基于 MarkItDown 强大的解析能力，生成高质量的 Markdown。
- **隐私安全**：默认情况下不保留上传的文件（处理即焚），可通过参数控制。
- **生产就绪**：包含文件大小限制、错误处理和日志记录，推荐使用 Gunicorn 部署。

## 🛠️ 安装部署

### 前置要求

- Python 3.8+ (推荐 Python 3.10+)
- 系统需安装相应的依赖库（如处理 PDF 可能需要系统级的依赖，具体取决于 MarkItDown 的底层需求）

### 1. 克隆项目与创建环境

```
# 创建并激活虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

```

### 2. 安装依赖

必须安装 `markitdown[all]` 以支持所有文件格式（PDF, Office 等）。

```
pip install -r requirements.txt
pip install flask python-dotenv gunicorn "markitdown[all]"

```

### 3. 配置环境 (可选)

项目会自动加载 `.env` 文件。你可以创建 `.env` 文件来覆盖默认配置：

```
PORT=6010
UPLOAD_DIR=/tmp/markitdown_uploads
MARKDOWN_DIR=/tmp/markitdown_markdowns
# 最大上传限制 (字节)，默认 16MB
MAX_CONTENT_LENGTH=16777216

```

## 🚀 启动服务

### 开发模式

```
python app.py

```

### 生产模式 (推荐)

使用 Gunicorn 启动 WSGI 服务：

```
# 启动 4 个 worker 进程，监听 6010 端口
gunicorn -w 4 -b 0.0.0.0:6010 app:app

```

## 🔌 API 文档

### 文档转换接口

将文件转换为 Markdown。

- **URL**: `/v1/convert`
- **Method**: `POST`
- **Content-Type**: `multipart/form-data`

### 请求参数 (Form Data)

| **参数名** | **类型** | **必填** | **默认值** | **描述** |
| --- | --- | --- | --- | --- |
| `file` | File | 是 | - | 需要转换的文档文件 |
| `keep_files` | Boolean | 否 | `false` | 是否在服务器保留原始文件和生成的 Markdown 文件。设为 `true` 用于调试。 |
| `nodeId` | String | 否 | - | 可选的节点 ID，用于回传给调用方 |

### 响应示例 (成功)

```
{
  "markdown": "# 文档标题\n\n这是转换后的 Markdown 内容...",
  "originalFilename": "report.pdf",
  "originalPath": null,
  "markdownPath": null,
  "nodeId": "12345"
}

```

> 注意: 如果 keep_files 为 false（默认），originalPath 和 markdownPath 将返回 null，且服务器上的临时文件会被立即删除。
> 

### cURL 调用示例

```
curl -X POST http://localhost:6010/v1/convert \
  -F "file=@/path/to/your/document.docx" \
  -F "keep_files=false"

```

## ⚠️ 常见问题

**Q: 转换 PDF 时报错 "MissingDependencyException"？**

A: 这是一个常见错误，通常是因为没有安装 MarkItDown 的完整依赖。请确保运行了以下命令：

```
pip install "markitdown[all]"

```

**Q: 上传大文件报错？**

A: 服务默认限制上传大小为 16MB。你可以通过设置环境变量 `MAX_CONTENT_LENGTH` 来调整此限制。

## 📜 许可证

本项目遵循 MIT 许可证。底层转换能力由 Microsoft MarkItDown 提供。

curl -F "file=@/path/to/your/file.docx" -F "output=html" -F "keep_files=false" http://localhost:6010/v1/convert