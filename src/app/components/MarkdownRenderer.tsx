import React from "react";

/**
 * Lightweight Markdown-to-React renderer.
 * Handles: headings, bold, italic, inline code, code blocks,
 * ordered/unordered lists, horizontal rules, blockquotes, links.
 * No external dependencies.
 */

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  const blocks = parseBlocks(content);
  return (
    <div className={`markdown-rendered space-y-2 ${className}`}>
      {blocks.map((block, i) => renderBlock(block, i))}
    </div>
  );
}

// ---- Block types ----
type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "code"; lang: string; code: string }
  | { type: "blockquote"; lines: string[] }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "hr" }
  | { type: "paragraph"; text: string };

function parseBlocks(raw: string): Block[] {
  const lines = raw.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.trimStart().startsWith("```")) {
      const lang = line.trimStart().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: "code", lang, code: codeLines.join("\n") });
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(\s*[-*_]){3,}\s*$/.test(line)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({ type: "heading", level: headingMatch[1].length, text: headingMatch[2].trim() });
      i++;
      continue;
    }

    // Blockquote
    if (line.trimStart().startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith("> ")) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ type: "blockquote", lines: quoteLines });
      continue;
    }

    // Unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ""));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    // Ordered list
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ""));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    // Empty line — skip
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph (collect consecutive non-blank lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trimStart().startsWith("```") &&
      !lines[i].trimStart().startsWith("> ") &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i]) &&
      !/^(\s*[-*_]){3,}\s*$/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: "paragraph", text: paraLines.join("\n") });
    }
  }

  return blocks;
}

function renderBlock(block: Block, key: number): React.ReactNode {
  switch (block.type) {
    case "heading": {
      const Tag = `h${block.level}` as keyof JSX.IntrinsicElements;
      const sizeClasses: Record<number, string> = {
        1: "text-[18px] font-bold mt-4 mb-2",
        2: "text-[16px] font-bold mt-3 mb-1.5",
        3: "text-[15px] font-semibold mt-2.5 mb-1",
        4: "text-[14px] font-semibold mt-2 mb-1",
        5: "text-[13px] font-medium mt-1.5 mb-0.5",
        6: "text-[13px] font-medium mt-1.5 mb-0.5",
      };
      return (
        <Tag key={key} className={`text-foreground ${sizeClasses[block.level] || ""}`}>
          {renderInline(block.text)}
        </Tag>
      );
    }

    case "code":
      return (
        <pre key={key} className="bg-muted/40 border border-border rounded-lg px-4 py-3 overflow-x-auto text-[12px] text-foreground/85 leading-relaxed">
          <code>{block.code}</code>
        </pre>
      );

    case "blockquote":
      return (
        <blockquote key={key} className="border-l-3 border-primary/40 pl-4 py-1 text-foreground/80 italic">
          {block.lines.map((l, j) => (
            <p key={j} className="text-[13px] leading-relaxed">{renderInline(l)}</p>
          ))}
        </blockquote>
      );

    case "ul":
      return (
        <ul key={key} className="space-y-1 ml-1">
          {block.items.map((item, j) => (
            <li key={j} className="flex items-start gap-2 text-[13px] text-foreground/90 leading-relaxed">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/50 mt-[7px] shrink-0" />
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );

    case "ol":
      return (
        <ol key={key} className="space-y-1 ml-1">
          {block.items.map((item, j) => (
            <li key={j} className="flex items-start gap-2 text-[13px] text-foreground/90 leading-relaxed">
              <span className="text-primary/70 font-medium text-[12px] mt-[1px] shrink-0 min-w-[18px]">{j + 1}.</span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ol>
      );

    case "hr":
      return <hr key={key} className="border-border my-3" />;

    case "paragraph":
      return (
        <p key={key} className="text-[13px] text-foreground/90 leading-relaxed">
          {renderInline(block.text)}
        </p>
      );

    default:
      return null;
  }
}

/**
 * Inline parser: bold, italic, inline code, links, strikethrough.
 */
function renderInline(text: string): React.ReactNode {
  if (!text) return null;

  // Regex that matches: **bold**, *italic*, `code`, [text](url), ~~strike~~
  const inlineRegex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)|(\[(.+?)\]\((.+?)\))|(~~(.+?)~~)/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inlineRegex.exec(text)) !== null) {
    // Text before the match
    if (match.index > lastIndex) {
      parts.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>);
    }

    if (match[1]) {
      // **bold**
      parts.push(
        <strong key={match.index} className="font-semibold text-foreground">
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      // *italic*
      parts.push(
        <em key={match.index} className="italic">
          {match[4]}
        </em>
      );
    } else if (match[5]) {
      // `code`
      parts.push(
        <code
          key={match.index}
          className="px-1.5 py-0.5 rounded bg-muted text-[12px] text-foreground/85 font-mono"
        >
          {match[6]}
        </code>
      );
    } else if (match[7]) {
      // [text](url)
      parts.push(
        <a
          key={match.index}
          href={match[9]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:opacity-80"
        >
          {match[8]}
        </a>
      );
    } else if (match[10]) {
      // ~~strikethrough~~
      parts.push(
        <del key={match.index} className="line-through text-muted-foreground">
          {match[11]}
        </del>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex)}</span>);
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}