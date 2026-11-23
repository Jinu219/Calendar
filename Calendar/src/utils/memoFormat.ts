// ═══════════════════════════════════════════════════════════
// Memo formatting — light, Markdown-like marks kept as plain text
// ═══════════════════════════════════════════════════════════
//
// Memos stay plain strings, so old memos, backups and other windows keep
// working. The memo shows these marks formatted while it isn't being edited:
//
//   # 제목  ## 중간 제목  ### 작은 제목
//   - 글머리 (또는 +)   1. 번호   - [ ] 체크 / - [x] 완료
//   **굵게**  *기울임*  ~~취소선~~
//   두 칸 들여쓰기 = 한 단계 (Tab)
//
// Edit helpers return a single replacement so the editor can apply it with
// the browser's own text insertion and keep Ctrl+Z working.

export type MemoLineKind = "h1" | "h2" | "h3" | "bullet" | "number" | "check" | "text" | "blank";

export interface MemoLine {
  kind: MemoLineKind;
  /** Leading whitespace as written. */
  indent: string;
  /** Nesting depth: a tab or two spaces per level. */
  level: number;
  /** The mark including its trailing space ("# ", "- ", "- [ ] ", "2. "), or "". */
  prefix: string;
  /** The line after its mark. */
  text: string;
  checked?: boolean;
  /** "3." for numbered lines. */
  number?: string;
}

export interface InlineSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
}

/** One replacement in the memo text and the selection to set afterwards. */
export interface MemoEdit {
  from: number;
  to: number;
  insert: string;
  selStart: number;
  selEnd: number;
}

export type LineFormat = "h1" | "h2" | "h3" | "bullet" | "check";

const INDENT_UNIT = "  ";

const CHECK_RE = /^(\s*)([-+] \[( |x|X)\](?: |$))(.*)$/;
const HEADING_RE = /^(\s*)((#{1,3}) )(.*)$/;
const BULLET_RE = /^(\s*)([-+] )(.*)$/;
const NUMBER_RE = /^(\s*)((\d{1,3})([.)]) )(.*)$/;

const levelOf = (indent: string): number => {
  let tabs = 0;
  let spaces = 0;
  for (const ch of indent) {
    if (ch === "\t") tabs += 1;
    else spaces += 1;
  }
  return tabs + Math.floor(spaces / 2);
};

export const parseMemoLine = (line: string): MemoLine => {
  if (!line.trim()) {
    return { kind: "blank", indent: line, level: levelOf(line), prefix: "", text: "" };
  }

  let match = CHECK_RE.exec(line);
  if (match) {
    return {
      kind: "check",
      indent: match[1],
      level: levelOf(match[1]),
      prefix: match[2],
      text: match[4],
      checked: match[3] !== " ",
    };
  }

  match = HEADING_RE.exec(line);
  if (match) {
    const kind = (["h1", "h2", "h3"] as const)[match[3].length - 1];
    return { kind, indent: match[1], level: levelOf(match[1]), prefix: match[2], text: match[4] };
  }

  match = BULLET_RE.exec(line);
  if (match) {
    return { kind: "bullet", indent: match[1], level: levelOf(match[1]), prefix: match[2], text: match[3] };
  }

  match = NUMBER_RE.exec(line);
  if (match) {
    return {
      kind: "number",
      indent: match[1],
      level: levelOf(match[1]),
      prefix: match[2],
      text: match[5],
      number: `${match[3]}${match[4]}`,
    };
  }

  const indent = /^\s*/.exec(line)?.[0] ?? "";
  return { kind: "text", indent, level: levelOf(indent), prefix: "", text: line.slice(indent.length) };
};

// ── Inline marks ────────────────────────────────────────────

const MARKS = [
  { mark: "**", flag: "bold" },
  { mark: "~~", flag: "strike" },
  { mark: "*", flag: "italic" },
] as const;

const isSpace = (ch: string | undefined) => ch === undefined || /\s/.test(ch);

/** Where `mark` closes, or -1. A closer never follows a space, and "*" is never half of "**". */
const findCloser = (text: string, mark: string, from: number): number => {
  for (let close = text.indexOf(mark, from); close !== -1; close = text.indexOf(mark, close + 1)) {
    if (isSpace(text[close - 1])) continue;
    if (mark === "*" && (text[close - 1] === "*" || text[close + 1] === "*")) continue;
    return close;
  }
  return -1;
};

/** Split one line of text into styled spans. Unmatched marks stay as typed. */
export const parseInline = (text: string, style: Omit<InlineSpan, "text"> = {}): InlineSpan[] => {
  const spans: InlineSpan[] = [];
  let plain = "";
  const flush = () => {
    if (plain) spans.push({ text: plain, ...style });
    plain = "";
  };

  let i = 0;
  while (i < text.length) {
    let matched = false;

    for (const { mark, flag } of MARKS) {
      if (!text.startsWith(mark, i)) continue;
      const innerStart = i + mark.length;
      if (isSpace(text[innerStart])) continue;
      if (mark === "*" && text[innerStart] === "*") continue;

      const close = findCloser(text, mark, innerStart + 1);
      if (close === -1) continue;

      flush();
      spans.push(...parseInline(text.slice(innerStart, close), { ...style, [flag]: true }));
      i = close + mark.length;
      matched = true;
      break;
    }

    if (!matched) {
      plain += text[i];
      i += 1;
    }
  }

  flush();
  return spans;
};

/** First non-empty line without any marks — for one-line previews. */
export const memoPreviewText = (content: string): string => {
  const line = content.split("\n").find(item => item.trim());
  if (!line) return "";
  return parseInline(parseMemoLine(line).text).map(span => span.text).join("").trim();
};

// ── Lines and offsets ───────────────────────────────────────

/** Index of the line holding character offset `pos`. */
export const lineIndexAt = (content: string, pos: number): number =>
  content.slice(0, Math.max(0, pos)).split("\n").length - 1;

/** Offset just after the last character of line `index`. */
export const lineEndOffset = (content: string, index: number): number => {
  const lines = content.split("\n");
  const safe = Math.min(Math.max(index, 0), lines.length - 1);
  return lines.slice(0, safe + 1).join("\n").length;
};

/** Offset where the line holding `pos` starts. */
const lineStartAt = (content: string, pos: number): number =>
  pos <= 0 ? 0 : content.lastIndexOf("\n", pos - 1) + 1;

/** Start of the first and end of the last line the selection touches. */
const lineBlock = (content: string, start: number, end: number) => {
  // A selection ending right after a line break doesn't include the next line.
  const last = end > start && content[end - 1] === "\n" ? end - 1 : end;
  const from = lineStartAt(content, start);
  const lineEnd = content.indexOf("\n", last);
  const to = lineEnd === -1 ? content.length : lineEnd;
  return { from, to, lines: content.slice(from, to).split("\n") };
};

/** Rewrite whole lines and keep the selection on the same text. */
const rewriteLines = (
  content: string,
  start: number,
  end: number,
  rewrite: (line: string, index: number, lines: string[]) => string
): MemoEdit => {
  const { from, to, lines } = lineBlock(content, start, end);
  const next = lines.map(rewrite);

  // Only the start of a line changes (its mark or indent); the text after it
  // is kept. A position in that text moves with it, and one inside the old
  // mark lands right after the new mark.
  const insert = next.join("\n");
  const delta = insert.length - (to - from);

  const mapOffset = (pos: number): number => {
    if (pos > to) return pos + delta;
    let oldOffset = from;
    let newOffset = from;
    for (let i = 0; i < lines.length; i += 1) {
      const oldLine = lines[i];
      const newLine = next[i];
      if (pos <= oldOffset + oldLine.length || i === lines.length - 1) {
        let kept = 0;
        while (
          kept < oldLine.length &&
          kept < newLine.length &&
          oldLine[oldLine.length - 1 - kept] === newLine[newLine.length - 1 - kept]
        ) kept += 1;
        const oldMarkEnd = oldLine.length - kept;
        const newMarkEnd = newLine.length - kept;
        const column = Math.min(pos - oldOffset, oldLine.length);
        return newOffset + (column >= oldMarkEnd ? newMarkEnd + column - oldMarkEnd : newMarkEnd);
      }
      oldOffset += oldLine.length + 1;
      newOffset += newLine.length + 1;
    }
    return newOffset;
  };

  // A selection that starts at a line start keeps the whole lines selected.
  const selStart = start !== end && start === from ? from : mapOffset(start);
  const selEnd = start === end ? selStart : Math.max(selStart, mapOffset(end));
  return { from, to, insert, selStart, selEnd };
};

// ── Line formats (제목, 글머리, 체크) ──────────────────────────

const PREFIX: Record<LineFormat, string> = {
  h1: "# ",
  h2: "## ",
  h3: "### ",
  bullet: "- ",
  check: "- [ ] ",
};

/**
 * Turn the selected lines into headings, bullets or checklist items, or back
 * to plain text when they all already are. Blank lines in a multi-line
 * selection are left alone.
 */
export const toggleLineFormat = (content: string, start: number, end: number, format: LineFormat): MemoEdit => {
  const { lines } = lineBlock(content, start, end);
  const targets = lines.length === 1 ? lines : lines.filter(line => line.trim());
  const allSet = targets.length > 0 && targets.every(line => parseMemoLine(line).kind === format);

  return rewriteLines(content, start, end, line => {
    if (lines.length > 1 && !line.trim()) return line;
    const parsed = parseMemoLine(line);
    const body = parsed.kind === "text" || parsed.kind === "blank" ? line.slice(parsed.indent.length) : parsed.text;
    return allSet ? `${parsed.indent}${body}` : `${parsed.indent}${PREFIX[format]}${body}`;
  });
};

/** 본문 → # → ## → ### → 본문, for one "제목" button. */
export const cycleHeading = (content: string, start: number, end: number): MemoEdit => {
  const { lines } = lineBlock(content, start, end);
  const current = parseMemoLine(lines.find(line => line.trim()) ?? lines[0]).kind;
  const next: LineFormat | null = current === "h1" ? "h2" : current === "h2" ? "h3" : current === "h3" ? null : "h1";
  if (next) return toggleLineFormat(content, start, end, next);
  return toggleLineFormat(content, start, end, "h3"); // all h3 → plain
};

// ── Indentation (Tab / Shift+Tab) ───────────────────────────

const outdentLine = (line: string): string => {
  if (line.startsWith("\t")) return line.slice(1);
  if (line.startsWith(INDENT_UNIT)) return line.slice(2);
  if (line.startsWith(" ")) return line.slice(1);
  return line;
};

/**
 * Tab: a caret inside plain text gets two spaces, like a code editor; list
 * items and selected lines move one level in. Shift+Tab moves them out.
 */
export const indentSelection = (content: string, start: number, end: number, outdent: boolean): MemoEdit => {
  const { from, lines } = lineBlock(content, start, end);

  if (!outdent && start === end && lines.length === 1) {
    const parsed = parseMemoLine(lines[0]);
    const isList = parsed.kind === "bullet" || parsed.kind === "number" || parsed.kind === "check";
    const inLeadingSpace = start - from <= parsed.indent.length;
    if (!isList && !inLeadingSpace) {
      return { from: start, to: end, insert: INDENT_UNIT, selStart: start + 2, selEnd: start + 2 };
    }
  }

  return rewriteLines(content, start, end, line => {
    if (lines.length > 1 && !line.trim()) return line;
    return outdent ? outdentLine(line) : `${INDENT_UNIT}${line}`;
  });
};

// ── Enter in a list ─────────────────────────────────────────

/**
 * Enter at the end of (or inside) a list item starts the next item; Enter on
 * an empty item ends the list (or moves it out a level). Returns null when
 * the default line break should happen.
 */
export const continueList = (content: string, caret: number): MemoEdit | null => {
  const from = lineStartAt(content, caret);
  const lineEnd = content.indexOf("\n", caret);
  const to = lineEnd === -1 ? content.length : lineEnd;
  const parsed = parseMemoLine(content.slice(from, to));

  if (parsed.kind !== "bullet" && parsed.kind !== "number" && parsed.kind !== "check") return null;

  const markEnd = from + parsed.indent.length + parsed.prefix.length;
  if (caret < markEnd) return null;

  if (!parsed.text.trim()) {
    if (parsed.level > 0) {
      const line = outdentLine(content.slice(from, to));
      return { from, to, insert: line, selStart: from + line.length, selEnd: from + line.length };
    }
    return { from, to, insert: "", selStart: from, selEnd: from };
  }

  let nextPrefix = parsed.prefix;
  if (parsed.kind === "check") nextPrefix = `${parsed.prefix.trimStart()[0]} [ ] `;
  if (parsed.kind === "number" && parsed.number) {
    const n = Number.parseInt(parsed.number, 10) + 1;
    nextPrefix = `${n}${parsed.number.slice(-1)} `;
  }

  const insert = `\n${parsed.indent}${nextPrefix}`;
  return { from: caret, to: caret, insert, selStart: caret + insert.length, selEnd: caret + insert.length };
};

// ── Inline marks (굵게, 기울임, 취소선) ─────────────────────────

const isWrapped = (text: string, mark: string) =>
  text.length > mark.length * 2 &&
  text.startsWith(mark) &&
  text.endsWith(mark) &&
  (mark !== "*" || (!text.startsWith("**") || text.startsWith("***")));

/** Wrap the selection in `mark`, or unwrap it when it already is. */
export const toggleInlineMark = (content: string, start: number, end: number, mark: "**" | "*" | "~~"): MemoEdit => {
  const m = mark.length;

  if (start === end) {
    const insert = mark + mark;
    return { from: start, to: end, insert, selStart: start + m, selEnd: start + m };
  }

  const selected = content.slice(start, end);

  // The marks sit just outside the selection: **[word]**
  const before = content.slice(start - m, start);
  const after = content.slice(end, end + m);
  const outerIsOtherMark = mark === "*" && content[start - 2] === "*" && content[end + 1] === "*" && content.slice(start - 3, start) !== "***";
  if (!selected.includes("\n") && before === mark && after === mark && !outerIsOtherMark) {
    return { from: start - m, to: end + m, insert: selected, selStart: start - m, selEnd: end - m };
  }

  // Each line of the selection is handled on its own (marks don't span lines).
  const pieces = selected.split("\n");
  const trimmed = pieces.map(piece => {
    const lead = /^\s*/.exec(piece)?.[0] ?? "";
    const core = piece.trim();
    const trail = piece.slice(lead.length + core.length);
    return { lead, core, trail };
  });
  const filled = trimmed.filter(piece => piece.core);
  const unwrap = filled.length > 0 && filled.every(piece => isWrapped(piece.core, mark));

  const insert = trimmed
    .map(({ lead, core, trail }) => {
      if (!core) return lead + trail;
      const inner = unwrap ? core.slice(m, -m) : mark + core + mark;
      return lead + inner + trail;
    })
    .join("\n");

  return { from: start, to: end, insert, selStart: start, selEnd: start + insert.length };
};

// ── Checklist ───────────────────────────────────────────────

/** Flip "- [ ]" / "- [x]" on one line of the memo. */
export const toggleChecklistLine = (content: string, lineIndex: number): string =>
  content
    .split("\n")
    .map((line, i) => {
      if (i !== lineIndex) return line;
      const parsed = parseMemoLine(line);
      if (parsed.kind !== "check") return line;
      const marker = parsed.prefix.trimStart()[0];
      const space = parsed.prefix.endsWith(" ") ? " " : "";
      return `${parsed.indent}${marker} [${parsed.checked ? " " : "x"}]${space}${parsed.text}`;
    })
    .join("\n");
