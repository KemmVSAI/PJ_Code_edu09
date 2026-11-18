import { Fragment } from "react";

import { cn } from "@/lib/utils";

interface MarkdownMessageProps {
  content: string;
  citations: string[];
  onCitationSelect: (paperId: string) => void;
  className?: string;
}

interface Block {
  type: "heading" | "list" | "paragraph";
  lines: string[];
}

const INLINE_PATTERN = /(\*\*[^*]+\*\*|\[\d+\])/g;

function parseBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;

  for (const raw of content.split("\n")) {
    const line = raw.trim();

    if (!line) {
      current = null;
    } else if (line.startsWith("## ")) {
      blocks.push({ type: "heading", lines: [line.slice(3)] });
      current = null;
    } else if (line.startsWith("- ")) {
      if (current?.type === "list") {
        current.lines.push(line.slice(2));
      } else {
        current = { type: "list", lines: [line.slice(2)] };
        blocks.push(current);
      }
    } else if (current?.type === "paragraph") {
      current.lines.push(line);
    } else {
      current = { type: "paragraph", lines: [line] };
      blocks.push(current);
    }
  }

  return blocks;
}

function renderInline(
  text: string,
  citations: string[],
  onCitationSelect: (id: string) => void,
) {
  return text.split(INLINE_PATTERN).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={index} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }

    const citationMatch = /^\[(\d+)\]$/.exec(part);
    if (citationMatch) {
      const number = Number(citationMatch[1]);
      const paperId = citations[number - 1];
      if (paperId) {
        return (
          <button
            key={index}
            type="button"
            onClick={() => onCitationSelect(paperId)}
            aria-label={`Open source ${number}`}
            className="mx-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded bg-indigo-50 px-1 align-super text-[10px] font-semibold text-primary ring-1 ring-inset ring-indigo-200 transition-colors hover:bg-indigo-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            {number}
          </button>
        );
      }
    }

    return <Fragment key={index}>{part}</Fragment>;
  });
}

export function MarkdownMessage({
  content,
  citations,
  onCitationSelect,
  className,
}: MarkdownMessageProps) {
  const blocks = parseBlocks(content);

  return (
    <div
      className={cn(
        "space-y-3 text-sm leading-relaxed text-foreground",
        className,
      )}
    >
      {blocks.map((block, blockIndex) => {
        if (block.type === "heading") {
          return (
            <h3
              key={blockIndex}
              className="pt-1 text-sm font-semibold text-foreground"
            >
              {renderInline(block.lines[0], citations, onCitationSelect)}
            </h3>
          );
        }

        if (block.type === "list") {
          return (
            <ul key={blockIndex} className="space-y-2">
              {block.lines.map((line, lineIndex) => (
                <li
                  key={lineIndex}
                  className="flex gap-3 text-muted-foreground"
                >
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  <span className="min-w-0">
                    {renderInline(line, citations, onCitationSelect)}
                  </span>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={blockIndex}>
            {renderInline(block.lines.join(" "), citations, onCitationSelect)}
          </p>
        );
      })}
    </div>
  );
}
