/**
 * markdown.mjs | a small, safe Markdown renderer.
 *
 * It exists for exactly one job: rendering Appendix G and the verbatim
 * doc_sections read only, without adding a dependency to audit. It escapes HTML
 * first and only then applies a fixed set of block and inline rules, so nothing
 * in final.md can inject markup.
 *
 * Supported: ATX headings, tables, unordered and ordered lists, blockquotes,
 * fenced code, horizontal rules, paragraphs, bold, italic, inline code, links.
 */

const PIPE = '\u0000PIPE\u0000';

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inline(text) {
  let s = escapeHtml(text);
  // Escaped pipes become literal pipes, matching how final.md writes them.
  s = s.replaceAll('\\\\|', PIPE).replaceAll('\\|', PIPE);
  s = s.replace(/`([^`]+)`/g, (_m, code) => `<code>${code}</code>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,;:)]|$)/g, '$1<em>$2</em>');
  // Only http and https links are turned into anchors, and always safely.
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label, href) => {
    const safe = href.replace(/"/g, '%22');
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  return s.replaceAll(PIPE, '|');
}

function splitRow(line) {
  let s = line.trim();
  s = s.replaceAll('\\\\|', PIPE).replaceAll('\\|', PIPE);
  const parts = s.split('|');
  parts.shift();
  if (parts.length && parts[parts.length - 1].trim() === '') parts.pop();
  return parts.map((c) => c.replaceAll(PIPE, '\\|').trim());
}

function isSeparator(line) {
  return /^\|(\s*:?-{3,}:?\s*\|)+\s*$/.test(line.trim());
}

export function renderMarkdown(markdown) {
  const lines = String(markdown ?? '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;

  const flushParagraph = (buf) => {
    if (buf.length) out.push(`<p>${inline(buf.join(' '))}</p>`);
    return [];
  };

  let para = [];

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code
    if (/^```/.test(line.trim())) {
      para = flushParagraph(para);
      const body = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1;
      out.push(`<pre><code>${escapeHtml(body.join('\n'))}</code></pre>`);
      continue;
    }

    // Heading
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      para = flushParagraph(para);
      const level = Math.min(6, heading[1].length + 1); // demote by one, the page owns h1
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }

    // Horizontal rule
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      para = flushParagraph(para);
      out.push('<hr>');
      i += 1;
      continue;
    }

    // Table
    if (line.trim().startsWith('|') && i + 1 < lines.length && isSeparator(lines[i + 1])) {
      para = flushParagraph(para);
      const header = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && !isSeparator(lines[i])) {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      const thead = `<thead><tr>${header.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${rows
        .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
        .join('')}</tbody>`;
      out.push(`<div class="tablewrap"><table class="table">${thead}${tbody}</table></div>`);
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      para = flushParagraph(para);
      const body = [];
      while (i < lines.length && (/^>\s?/.test(lines[i]) || (lines[i].trim() === '' && /^>/.test(lines[i + 1] ?? '')))) {
        body.push(lines[i].replace(/^>\s?/, ''));
        i += 1;
      }
      out.push(`<blockquote>${body.map((b) => (b.trim() ? `<p>${inline(b)}</p>` : '')).join('')}</blockquote>`);
      continue;
    }

    // Unordered list
    if (/^[-*+]\s+/.test(line)) {
      para = flushParagraph(para);
      const items = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*+]\s+/, ''));
        i += 1;
      }
      out.push(`<ul>${items.map((it) => `<li>${inline(it)}</li>`).join('')}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\d+[.)]\s+/.test(line)) {
      para = flushParagraph(para);
      const items = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+[.)]\s+/, ''));
        i += 1;
      }
      out.push(`<ol>${items.map((it) => `<li>${inline(it)}</li>`).join('')}</ol>`);
      continue;
    }

    if (line.trim() === '') {
      para = flushParagraph(para);
      i += 1;
      continue;
    }

    para.push(line.trim());
    i += 1;
  }
  flushParagraph(para);
  return out.join('\n');
}

export { escapeHtml };
