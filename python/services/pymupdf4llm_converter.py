import logging
import os
import tempfile
import base64
import re
import mimetypes
import io

# --- 依赖导入 ---
# pip install pymupdf4llm pymupdf Pillow
try:
    import pymupdf4llm
    import fitz  # PyMuPDF 的核心库
except ImportError:
    pymupdf4llm = None
    fitz = None

# 引入 Pillow 用于图片拼接
try:
    from PIL import Image
    HAS_PILLOW = True
except ImportError:
    HAS_PILLOW = False

logger = logging.getLogger("DocService.PyMuPDF")

class PyMuPDFConverter:
    """
    专门用于 PDF 到 Markdown 的转换器
    优势：基于 PyMuPDF，能够极好地还原多栏布局、表格等复杂结构。
    特性：
    1. 支持将图片转换为 Base64 嵌入 Markdown。
    2. [增强] 支持将复杂表格直接替换为截图，并自动拼接跨页表格。
    3. 自动修复 Markdown 表格格式问题。
    """
    
    def __init__(self):
        self.is_available = pymupdf4llm is not None and fitz is not None
        if not self.is_available:
            logger.warning("PyMuPDF library not found.")
        if not HAS_PILLOW:
            logger.warning("Pillow library not found. Table stitching will be disabled.")

    def _pixmap_to_pil(self, pix) -> Image.Image:
        """将 fitz.Pixmap 转换为 PIL.Image"""
        if not HAS_PILLOW: return None
        try:
            # 使用 PNG 格式中转，最稳健
            img_data = pix.tobytes("png")
            return Image.open(io.BytesIO(img_data))
        except Exception as e:
            logger.error(f"Pixmap to PIL error: {e}")
            return None

    def _pil_to_base64(self, img: Image.Image) -> str:
        """将 PIL.Image 转换为 Base64"""
        try:
            buffered = io.BytesIO()
            img.save(buffered, format="PNG")
            return f"data:image/png;base64,{base64.b64encode(buffered.getvalue()).decode('utf-8')}"
        except Exception as e:
            logger.error(f"PIL to Base64 error: {e}")
            return ""
            
    def _image_to_base64(self, local_path: str) -> str:
        """读取本地图片文件并转为 Base64"""
        mime_type, _ = mimetypes.guess_type(local_path)
        if not mime_type: mime_type = 'image/png'
        try:
            with open(local_path, "rb") as f:
                return f"data:{mime_type};base64,{base64.b64encode(f.read()).decode('utf-8')}"
        except Exception:
            return ""

    def _stitch_images_vertically(self, images: list) -> str:
        """垂直拼接多张 PIL 图片并返回 Base64"""
        if not images or not HAS_PILLOW: return ""
        if len(images) == 1:
            return self._pil_to_base64(images[0])
        
        # 计算总尺寸
        total_height = sum(img.height for img in images)
        max_width = max(img.width for img in images)
        
        # 创建画布
        merged_img = Image.new('RGB', (max_width, total_height), (255, 255, 255))
        
        # 逐张粘贴
        y_offset = 0
        for img in images:
            # 居中粘贴 (防止宽度微小差异导致的错位)
            x_offset = (max_width - img.width) // 2
            merged_img.paste(img, (x_offset, y_offset))
            y_offset += img.height
            
        return self._pil_to_base64(merged_img)

    def _preprocess_tables_to_images(self, doc) -> dict:
        """
        核心逻辑：扫描 -> 分组(识别跨页) -> 截图 -> 拼接 -> 涂改(物理删除+视觉遮盖)
        """
        if not HAS_PILLOW:
            logger.warning("Skipping table stitching because Pillow is missing.")
            return {}

        # 1. 收集所有表格信息
        all_tables = []
        
        for page_index, page in enumerate(doc):
            # snap=True/intersection: 提高表格检测的容错率
            tables = page.find_tables(horizontal_strategy="lines", vertical_strategy="lines")
            for table in tables:
                all_tables.append({
                    'page_index': page_index,
                    'bbox': table.bbox, # (x0, y0, x1, y1)
                    'page_height': page.rect.height,
                    'table_obj': table
                })

        if not all_tables:
            return {}

        # 2. 分组逻辑 (识别哪些表格属于同一个跨页表格)
        table_groups = []
        if all_tables:
            current_group = [all_tables[0]]
            
            for i in range(1, len(all_tables)):
                prev = current_group[-1]
                curr = all_tables[i]
                
                is_next_page = curr['page_index'] == prev['page_index'] + 1
                prev_width = prev['bbox'][2] - prev['bbox'][0]
                curr_width = curr['bbox'][2] - curr['bbox'][0]
                is_width_similar = abs(prev_width - curr_width) < 10
                
                is_bottom = prev['bbox'][3] > (prev['page_height'] - 100)
                is_top = curr['bbox'][1] < 100
                
                if is_next_page and is_width_similar and is_bottom and is_top:
                    current_group.append(curr)
                else:
                    table_groups.append(current_group)
                    current_group = [curr]
            
            table_groups.append(current_group)

        # 3. 处理每个分组：截图、拼接、涂改
        table_replacements = {}
        
        for group_idx, group in enumerate(table_groups):
            pil_images = []
            padding = 2 
            
            for t_info in group:
                page = doc[t_info['page_index']]
                bbox = fitz.Rect(t_info['bbox'])
                
                # A. 截图 (Screenshot)
                clip_rect = bbox + (-padding, -padding, padding, padding)
                pix = page.get_pixmap(clip=clip_rect, matrix=fitz.Matrix(2, 2))
                pil_img = self._pixmap_to_pil(pix)
                if pil_img:
                    pil_images.append(pil_img)
                
                # B. 物理移除 (Redact) - 必须加回来！
                # 这是防止文字被重复输出的关键：彻底从 PDF 流中删除该区域的文字
                page.add_redact_annot(bbox)
                page.apply_redactions() 
                
                # C. 视觉遮盖 (White Mask) - 双重保险
                # 用于遮盖 Redaction 可能遗漏的表格矢量线 (Ghost Lines)
                shape = page.new_shape()
                shape.draw_rect(bbox + (-1, -1, 1, 1))
                shape.finish(color=(1, 1, 1), fill=(1, 1, 1)) # 白色填充
                shape.commit()

            # 拼接图片
            if not pil_images: continue
            base64_result = self._stitch_images_vertically(pil_images)
            
            # 4. 插入占位符
            first_t = group[0]
            first_page = doc[first_t['page_index']]
            marker_key = f"@@TABLE_GROUP_{group_idx}@@"
            
            # D. 插入黑色文字
            # 插入在表格左上角，确保占位符能被 Markdown 转换器读取到
            # 注意：必须在 Redact 之后插入，否则会被删掉
            insert_point = (first_t['bbox'][0], first_t['bbox'][1] + 10)
            first_page.insert_text(
                insert_point, 
                marker_key, 
                fontsize=10, 
                color=(0, 0, 0) # 黑色
            )
            
            table_replacements[marker_key] = base64_result

        return table_replacements

    def _fix_markdown_tables(self, md_content: str) -> str:
        """修复 Markdown 表格格式 (针对未转图片的简单表格)"""
        lines = md_content.split('\n')
        new_lines = []
        in_table = False
        for line in lines:
            stripped = line.strip()
            is_table_row = stripped.startswith('|') and (stripped.endswith('|') or len(stripped.split('|')) > 2)
            if is_table_row:
                if not in_table:
                    if new_lines and new_lines[-1].strip() != '': new_lines.append('')
                    in_table = True
            else:
                if in_table:
                    if stripped != '': new_lines.append('')
                    in_table = False
            new_lines.append(line)
        return '\n'.join(new_lines)

    def convert(self, input_path: str, convert_tables_to_images: bool = False) -> str:
        """主转换函数"""
        if not self.is_available: raise RuntimeError("PyMuPDF not installed.")
        if not os.path.exists(input_path): raise FileNotFoundError(f"File not found: {input_path}")

        try:
            logger.info(f"Processing PDF: {input_path} | Merge Tables: {convert_tables_to_images}")
            
            with fitz.open(input_path) as doc:
                table_map = {}
                
                # 策略: 仅当开启表格转图片时，执行复杂的拼接逻辑
                if convert_tables_to_images:
                    table_map = self._preprocess_tables_to_images(doc)
                    logger.info(f"Processed {len(table_map)} table groups.")
                
                with tempfile.TemporaryDirectory() as temp_dir:
                    temp_pdf_path = os.path.join(temp_dir, "processing.pdf")
                    # 保存涂改后的 PDF
                    doc.save(temp_pdf_path)
                    
                    # 转 Markdown
                    md_content = pymupdf4llm.to_markdown(temp_pdf_path, write_images=True, image_path=temp_dir)
                    md_content = self._fix_markdown_tables(md_content)

                    # 1. 替换普通图片
                    for img_file in os.listdir(temp_dir):
                        if img_file.endswith(('.png', '.jpg', '.jpeg')):
                            img_path = os.path.join(temp_dir, img_file)
                            b64 = self._image_to_base64(img_path)
                            if b64:
                                pattern = re.compile(rf'!\[(.*?)\]\({re.escape(img_file)}\)')
                                md_content = pattern.sub(rf'![\1]({b64})', md_content)

                    # 2. 替换拼接好的表格图片
                    if table_map:
                        for marker, b64_table in table_map.items():
                            # 替换占位符
                            if marker in md_content:
                                md_content = md_content.replace(marker, f"\n\n![Merged Table]({b64_table})\n\n")
                            else:
                                logger.warning(f"Marker {marker} not found in Markdown output.")
                    
                    return md_content

        except Exception as e:
            logger.exception(f"PDF conversion error")
            raise