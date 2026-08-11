import os
import base64
import mimetypes
import tempfile
import logging
from bs4 import BeautifulSoup
from typing import Optional

# 尝试导入依赖
try:
    import pypandoc
except ImportError:
    pypandoc = None

try:
    import bleach
    HAS_BLEACH = True
except ImportError:
    HAS_BLEACH = False

logger = logging.getLogger("DocService.HTML")

class PandocProcessor:
    """处理 Docx 到 HTML 的转换，包含结构修复和图片处理"""
    
    def __init__(self, use_base64_images: bool = True):
        self.use_base64_images = use_base64_images
        
        # Bleach 白名单配置
        self.allowed_tags = [
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
            'p', 'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'u', 
            'span', 'div', 'img', 'table', 'thead', 'tbody', 'tr', 'td', 'th',
            'blockquote', 'code', 'pre', 'a'
        ]
        self.allowed_attrs = {
            '*': ['class', 'style', 'id'],
            'a': ['href', 'target'],
            'img': ['src', 'alt', 'width', 'height'],
        }

    def _sanitize_html(self, html_content: str) -> str:
        """XSS 防护"""
        if not HAS_BLEACH:
            return html_content
        return bleach.clean(
            html_content,
            tags=self.allowed_tags,
            attributes=self.allowed_attrs,
            strip=True 
        )

    def _image_to_base64(self, local_path: str) -> str:
        """读取本地图片并转为 Base64"""
        mime_type, _ = mimetypes.guess_type(local_path)
        if not mime_type:
            mime_type = 'image/png'
        try:
            with open(local_path, "rb") as image_file:
                encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
            return f"data:{mime_type};base64,{encoded_string}"
        except Exception as e:
            logger.error(f"Base64 conversion error: {e}")
            return ""

    def _process_images(self, soup: BeautifulSoup, media_dir: str):
        """处理 HTML 中的图片链接，转为 Base64"""
        if not self.use_base64_images:
            return

        for img in soup.find_all('img'):
            src = img.get('src')
            if not src: continue
            
            # Pandoc 导出的 src 通常是相对路径
            local_path = os.path.join(media_dir, src)
            
            # 容错：尝试只用文件名查找
            if not os.path.exists(local_path):
                local_path = os.path.join(media_dir, os.path.basename(src))

            if os.path.exists(local_path):
                b64_src = self._image_to_base64(local_path)
                if b64_src:
                    img['src'] = b64_src

    def _fix_structural_issues(self, soup: BeautifulSoup) -> dict:
        """修复伪标题结构 (保留数据安全逻辑)"""
        stats = {"fixed": 0, "skipped": 0}
        
        for strong in soup.find_all('strong'):
            # 检查结构 li -> p -> strong
            p_tag = strong.parent
            if not (p_tag and p_tag.name == 'p'): continue
            li_tag = p_tag.parent
            if not (li_tag and li_tag.name == 'li'): continue
                
            # 检查内容完整性 (防止数据丢失)
            if len(p_tag.get_text(strip=True)) != len(strong.get_text(strip=True)):
                stats["skipped"] += 1
                continue
                
            # 执行提升逻辑
            new_header = soup.new_tag("h3")
            new_header.string = strong.get_text(strip=True)
            
            list_container = li_tag.find_parent(['ol', 'ul'])
            if list_container:
                list_container.insert_before(new_header)
                li_tag.decompose()
                if not list_container.find_all('li'):
                    list_container.decompose()
                stats["fixed"] += 1
                
        return stats

    def convert(self, input_path: str) -> str:
        """执行转换流程"""
        if not pypandoc:
            raise RuntimeError("pypandoc not installed on server")

        # 使用临时目录，转换完成后自动清理中间图片
        with tempfile.TemporaryDirectory() as temp_dir:
            media_dir = os.path.join(temp_dir, "media")
            os.makedirs(media_dir, exist_ok=True)

            # 1. Pandoc Docx -> HTML
            # 如果是其他格式，Pandoc 也支持，但 structural fix 主要针对 docx
            try:
                html_source = pypandoc.convert_file(
                    input_path, 
                    'html', 
                    extra_args=[
                        '--wrap=none', 
                        f'--extract-media={media_dir}', 
                        '--standalone' 
                    ]
                )
            except Exception as e:
                logger.error(f"Pandoc conversion failed: {e}")
                raise

            # 2. BeautifulSoup 处理
            soup = BeautifulSoup(html_source, 'html.parser')

            # 3. 修复结构 & 处理图片
            stats = self._fix_structural_issues(soup)
            logger.info(f"Structure fixed stats: {stats}")
            
            self._process_images(soup, media_dir)

            final_html = str(soup)

            # 4. 安全清洗
            if HAS_BLEACH:
                final_html = self._sanitize_html(final_html)

            return final_html