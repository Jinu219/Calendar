import React from "react";
import { parseInline, parseMemoLine, type InlineSpan } from "../utils";

interface MemoRichViewProps {
  content: string;
  /** Start editing with the caret at the end of this line. */
  onEditLine: (lineIndex: number) => void;
  onToggleCheck: (lineIndex: number) => void;
}

const BULLETS = ["•", "◦", "▪"];

const renderSpans = (text: string): React.ReactNode =>
  parseInline(text).map((span: InlineSpan, i) => {
    const className = [
      span.bold ? "memo-b" : "",
      span.italic ? "memo-i" : "",
      span.strike ? "memo-s" : "",
    ].filter(Boolean).join(" ");
    return className ? <span key={i} className={className}>{span.text}</span> : <React.Fragment key={i}>{span.text}</React.Fragment>;
  });

/**
 * The memo as you read it: headings, lists, checkboxes and inline styles.
 * Clicking a line opens the editor there; checkboxes toggle in place.
 */
export const MemoRichView: React.FC<MemoRichViewProps> = ({ content, onEditLine, onToggleCheck }) => {
  const lines = content.split("\n");

  const editFromEvent = (event: React.MouseEvent<HTMLDivElement>) => {
    const lineElement = (event.target as HTMLElement).closest<HTMLElement>("[data-line]");
    onEditLine(lineElement ? Number(lineElement.dataset.line) : lines.length - 1);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onEditLine(lines.length - 1);
    }
  };

  return (
    <div
      className="memo-rich"
      role="group"
      aria-label="메모 내용. Enter를 누르거나 클릭하면 편집"
      tabIndex={0}
      onClick={editFromEvent}
      onKeyDown={handleKeyDown}
    >
      {lines.map((raw, index) => {
        const line = parseMemoLine(raw);
        const indentStyle = line.level > 0 ? { paddingLeft: `${line.level * 1.2}em` } : undefined;

        switch (line.kind) {
          case "blank":
            return <div key={index} data-line={index} className="memo-line memo-blank" />;
          case "h1":
          case "h2":
          case "h3":
            return (
              <div
                key={index}
                data-line={index}
                className={`memo-line memo-${line.kind}`}
                role="heading"
                aria-level={line.kind === "h1" ? 1 : line.kind === "h2" ? 2 : 3}
              >
                {renderSpans(line.text)}
              </div>
            );
          case "bullet":
          case "number":
            return (
              <div key={index} data-line={index} className="memo-line memo-list-item" style={indentStyle}>
                <span className="memo-list-mark" aria-hidden="true">
                  {line.kind === "number" ? line.number : BULLETS[Math.min(line.level, BULLETS.length - 1)]}
                </span>
                <span className="memo-list-text">{renderSpans(line.text)}</span>
              </div>
            );
          case "check":
            return (
              <div
                key={index}
                data-line={index}
                className={`memo-line memo-list-item memo-check ${line.checked ? "done" : ""}`}
                style={indentStyle}
              >
                <input
                  type="checkbox"
                  className="memo-check-box"
                  checked={line.checked}
                  aria-label={`${line.text || "빈 항목"} ${line.checked ? "완료" : "미완료"}`}
                  onClick={event => event.stopPropagation()}
                  onChange={() => onToggleCheck(index)}
                />
                <span className="memo-list-text">{renderSpans(line.text)}</span>
              </div>
            );
          default:
            return (
              <div key={index} data-line={index} className="memo-line memo-text">
                {line.indent}
                {renderSpans(line.text)}
              </div>
            );
        }
      })}
    </div>
  );
};

export default MemoRichView;
