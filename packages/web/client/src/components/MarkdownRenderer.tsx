/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js';

// Configure marked
marked.setOptions({
  breaks: true,
  gfm: true,
});

// Custom renderer for syntax highlighting
const renderer = new marked.Renderer();

renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
  const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
  const highlighted = hljs.highlight(text, { language }).value;
  return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
};

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const html = useMemo(() => {
    try {
      return marked(content, { renderer });
    } catch {
      return content;
    }
  }, [content]);

  return (
    <div
      className="markdown-content"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
