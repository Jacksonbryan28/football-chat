import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Renders the model's markdown (bold, lists, tables) as sanitized HTML.
// Styles for the rendered elements live under .markdown in src/styles/global.css.
export function Markdown({ text }: { text: string }) {
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(text, { async: false }) as string), [text]);
  return <div className="markdown" dangerouslySetInnerHTML={{ __html: html }} />;
}
