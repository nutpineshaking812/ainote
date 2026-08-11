import { z } from 'zod';
import axios from 'axios';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import { logger } from '../../../config/logger.js';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
];

const getRandomUserAgent = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

// Configure Turndown for clean Markdown
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  hr: '---',
});

// Remove script/style/ads-related tags in Turndown (as fallback if Readability misses some)
turndownService.remove(['script', 'style', 'noscript', 'iframe', 'ads', 'promo']);

/**
 * Cleanup and truncate final results to avoid context blowout
 */
const processFinalResults = (content, url, title) => {
  // Replace multiple line breaks or spaces with a single one to save tokens, but keep formatting
  let text = content.replace(/\n\s*\n/g, '\n\n').trim();
  
  // High-limit, but ensures model stays within context limits
  const maxLength = 25000;
  if (text.length > maxLength) {
    text = text.substring(0, maxLength) + '\n\n... (Content truncated for context window efficiency)';
  }

  return `
[Web Fetch Results: ${title || url}]
${text}
---
  `.trim();
};

export const webFetchTool = {
  isGlobal: true,
  name: 'web_fetch',
  description: 'Fetches the main content of a public web page (documentation, articles, etc.) and converts it to clean Markdown. Highly effective for reading information while skipping ads and navigation.',
  inputSchema: z.object({
    url: z.string().describe('The complete URL of the web page to fetch (e.g., https://en.wikipedia.org/wiki/AI)'),
  }),
  execute: async ({ url }) => {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': 'https://www.google.com/',
          'Cache-Control': 'no-cache',
          'Upgrade-Insecure-Requests': '1',
          'Connection': 'keep-alive',
        },
        timeout: 20000,
        maxRedirects: 5,
        responseType: 'arraybuffer', // Handle encodings properly
      });

      // Try to determine encoding, default to utf-8
      const buffer = Buffer.from(response.data);
      const html = buffer.toString('utf-8');

      if (!html || html.length < 50) {
        return `Fetch error: The page at ${url} returned empty or extremely short content.`;
      }

      // Use JSDOM to parse HTML
      const dom = new JSDOM(html, { url });
      
      // Use Readability to extract the "meat" of the page (skips ads, sidebars, footers)
      const reader = new Readability(dom.window.document);
      const article = reader.parse();

      if (!article || (!article.textContent && !article.content)) {
        // Fallback to basic extraction if Readability fails
        const bodyContent = dom.window.document.body ? dom.window.document.body.innerHTML : html;
        const fallbackMd = turndownService.turndown(bodyContent);
        return processFinalResults(fallbackMd, url, 'Fallback (Full Body)');
      }

      // Convert clean HTML to Markdown
      const markdownContent = turndownService.turndown(article.content);
      const finalTitle = article.title || 'Untitled Page';
      const finalHeader = `# ${finalTitle}\n\n*Source: ${url}*\n\n---\n\n`;
      const combined = finalHeader + markdownContent;

      return processFinalResults(combined, url, finalTitle);

    } catch (error) {
      if (error.response) {
        return `Failed to fetch URL ${url}. Status: ${error.response.status} ${error.response.statusText}`;
      }
      return `Failed to fetch URL ${url}. Error: ${error.message}`;
    }
  },
};
