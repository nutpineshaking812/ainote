import { describe, it, expect } from 'vitest';
import {
  splitMarkdownBySections,
  updateSectionInMarkdown,
  extractSectionByHeader,
} from '../../utils/markdownUtils.js';

describe('markdownUtils - splitMarkdownBySections', () => {
  it('应该支持基础的三级标题嵌套路径', () => {
    const markdown = `# 文档标题
一级内容
## 二级模块
二级内容
### 三级功能
功能描述文本
### 另一个三级
其他文本`;
    const sections = splitMarkdownBySections(markdown);

    expect(sections).toHaveLength(4);
    expect(sections[0].header).toBe('## 文档标题');
    expect(sections[1].header).toBe('## 文档标题 > 二级模块');
    expect(sections[2].header).toBe('## 文档标题 > 二级模块 > 三级功能');
    expect(sections[3].header).toBe('## 文档标题 > 二级模块 > 另一个三级');
  });

  it('当从三级标题跳回二级标题时，路径栈应该正确重置', () => {
    const markdown = `# 应用
## 模块A
### 功能1
内容1
## 模块B
正文B`;
    const sections = splitMarkdownBySections(markdown);

    expect(sections).toHaveLength(2);
    expect(sections[0].header).toBe('## 应用 > 模块A > 功能1');
    expect(sections[1].header).toBe('## 应用 > 模块B');
  });

  it('应该正确处理没有任何标题的长文本并进行自动分片', () => {
    const longText = '这是一段测试文本。\n'.repeat(100);
    const sections = splitMarkdownBySections(longText, { maxChunkSize: 200 });

    expect(sections.length).toBeGreaterThan(1);
    expect(sections[0].header).toBe('## Introduction');
    expect(sections[1].header).toBe('## Introduction (Part 2)');
  });

  it('应该自动忽略没有正文内容的标题', () => {
    const markdown = `## 有内容的标题
一些正文
## 没内容的标题1
## 没内容的标题2
## 最终有内容的标题
最后的正文`;
    const sections = splitMarkdownBySections(markdown);

    expect(sections).toHaveLength(2);
    expect(sections[0].header).toBe('## Introduction > 有内容的标题');
    expect(sections[1].header).toBe('## Introduction > 最终有内容的标题');
  });

  it('应该支持自定义默认根标题', () => {
    const markdown = '这是一段直接开始的正文';
    const sections = splitMarkdownBySections(markdown, { defaultRoot: '我的笔记' });

    expect(sections[0].header).toBe('## 我的笔记');
    expect(sections[0].content).toBe('这是一段直接开始的正文');
  });

  it('应该在遇到空行时优先进行长分片切割', () => {
    const part1 = '很有节奏感的文本行第一行，我们要让它足够长超过阈值。'.repeat(10) + '\n\n';
    const part2 = '超长行超过限制'.repeat(100);
    const markdown = part1 + part2;

    const sections = splitMarkdownBySections(markdown, { maxChunkSize: 100 });

    expect(sections.length).toBeGreaterThan(1);
    expect(sections[0].content.trim()).toContain('很有节奏感的文本行第一行');
  });

  it('对于复杂混乱的标题等级变动应该具有鲁棒性', () => {
    const markdown = `### 孤立的三级
内容3
## 回到二级
内容2
# 最后才出现一级
内容1`;
    const sections = splitMarkdownBySections(markdown);

    expect(sections).toHaveLength(3);
    expect(sections[0].header).toBe('## Introduction > 孤立的三级');
    expect(sections[1].header).toBe('## Introduction > 回到二级');
    expect(sections[2].header).toBe('## 最后才出现一级');
  });

  describe('updateSectionInMarkdown', () => {
    it('应该能精准更新一个带路径的 Breadcrumb 段落', () => {
      const oldMarkdown = `## 会话A > 背景
旧内容`;
      const updated = updateSectionInMarkdown(oldMarkdown, '会话A > 背景', '新内容', {
        defaultRoot: '会话A',
      });

      expect(updated).toContain('## 会话A > 背景');
      expect(updated).toContain('新内容');
      expect(updated).not.toContain('旧内容');
    });

    it('当标题不存在时，应该按路径规则追加', () => {
      const oldMarkdown = `## 会话A > 背景
内容1`;
      const updated = updateSectionInMarkdown(oldMarkdown, '偏好', '内容2', {
        defaultRoot: '会话A',
      });

      expect(updated).toContain('## 会话A > 背景');
      expect(updated).toContain('## 会话A > 偏好');
    });

    it('如果传入了全路径标题，即便 defaultRoot 不同也应该匹配成功', () => {
      const oldMarkdown = `## 会话A > 背景
内容`;
      const updated = updateSectionInMarkdown(oldMarkdown, '## 会话A > 背景', '全替换内容');

      expect(updated).toContain('全替换内容');
    });
  });

  describe('extractSectionByHeader', () => {
    it('应该能提取带路径的段落内容', () => {
      const markdown = `## 根 > 子项
内容123`;
      const content = extractSectionByHeader(markdown, '根 > 子项');
      expect(content).toBe('内容123');
    });
  });

  it('输入为空时应该返回空数组', () => {
    expect(splitMarkdownBySections('')).toEqual([]);
    expect(splitMarkdownBySections(null)).toEqual([]);
  });
});
