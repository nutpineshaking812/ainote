import logging

try:
    from markitdown import MarkItDown
except ImportError:
    MarkItDown = None

logger = logging.getLogger("DocService.MarkItDown")

class MarkItDownProcessor:
    def __init__(self):
        if MarkItDown is None:
            raise RuntimeError("MarkItDown library missing. Please install 'markitdown'.")
        self.md_converter = MarkItDown()

    def convert(self, input_path: str) -> str:
        """将文档转换为 Markdown"""
        try:
            # keep_data_uris=True 确保 Markdown 里的图片也是 Base64
            result = self.md_converter.convert(input_path, keep_data_uris=True)
            
            markdown_text = result.text_content if result.text_content else ""
            logger.info(f"MarkItDown conversion successful (Length: {len(markdown_text)})")
            
            return markdown_text
        except Exception as e:
            logger.error(f"MarkItDown failed: {e}")
            raise