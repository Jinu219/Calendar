import { describe, expect, it } from "vitest";
import {
  continueList,
  cycleHeading,
  indentSelection,
  lineEndOffset,
  lineIndexAt,
  memoPreviewText,
  parseInline,
  parseMemoLine,
  toggleChecklistLine,
  toggleInlineMark,
  toggleLineFormat,
  type MemoEdit,
} from "./memoFormat";

/** Apply an edit and show the selection as [ ] (or | for a caret). */
const run = (edit: MemoEdit | null, content: string): string => {
  if (!edit) return "(default)";
  const next = content.slice(0, edit.from) + edit.insert + content.slice(edit.to);
  if (edit.selStart === edit.selEnd) return `${next.slice(0, edit.selStart)}|${next.slice(edit.selStart)}`;
  return `${next.slice(0, edit.selStart)}[${next.slice(edit.selStart, edit.selEnd)}]${next.slice(edit.selEnd)}`;
};

/** "ab|c" → content "abc" with the caret at 2; "a[b]c" → selection 1..2. */
const at = (marked: string): [string, number, number] => {
  const caret = marked.indexOf("|");
  if (caret !== -1) return [marked.replace("|", ""), caret, caret];
  const start = marked.indexOf("[");
  const end = marked.indexOf("]") - 1;
  return [marked.replace("[", "").replace("]", ""), start, end];
};

describe("parseMemoLine", () => {
  it("reads headings, lists, checklists and plain text", () => {
    expect(parseMemoLine("# 제목")).toMatchObject({ kind: "h1", text: "제목" });
    expect(parseMemoLine("### 작게")).toMatchObject({ kind: "h3", text: "작게" });
    expect(parseMemoLine("#해시태그")).toMatchObject({ kind: "text", text: "#해시태그" });
    expect(parseMemoLine("- 사과")).toMatchObject({ kind: "bullet", text: "사과", level: 0 });
    expect(parseMemoLine("+ 배")).toMatchObject({ kind: "bullet", text: "배" });
    expect(parseMemoLine("    - 깊게")).toMatchObject({ kind: "bullet", level: 2 });
    expect(parseMemoLine("\t- 탭")).toMatchObject({ kind: "bullet", level: 1 });
    expect(parseMemoLine("3. 셋째")).toMatchObject({ kind: "number", number: "3.", text: "셋째" });
    expect(parseMemoLine("- [ ] 우유")).toMatchObject({ kind: "check", checked: false, text: "우유" });
    expect(parseMemoLine("  - [x] 빵")).toMatchObject({ kind: "check", checked: true, level: 1, text: "빵" });
    expect(parseMemoLine("- [ ]")).toMatchObject({ kind: "check", text: "" });
    expect(parseMemoLine("-마이너스")).toMatchObject({ kind: "text" });
    expect(parseMemoLine("   ")).toMatchObject({ kind: "blank" });
  });
});

describe("parseInline", () => {
  it("styles bold, italic and strikethrough, nested too", () => {
    expect(parseInline("a **b** c")).toEqual([{ text: "a " }, { text: "b", bold: true }, { text: " c" }]);
    expect(parseInline("*기울임*")).toEqual([{ text: "기울임", italic: true }]);
    expect(parseInline("~~끝~~남음")).toEqual([{ text: "끝", strike: true }, { text: "남음" }]);
    expect(parseInline("**굵게 *둘 다* 끝**")).toEqual([
      { text: "굵게 ", bold: true },
      { text: "둘 다", bold: true, italic: true },
      { text: " 끝", bold: true },
    ]);
    expect(parseInline("*a **b** c*")).toEqual([
      { text: "a ", italic: true },
      { text: "b", italic: true, bold: true },
      { text: " c", italic: true },
    ]);
  });

  it("leaves unmatched or spaced marks as typed", () => {
    expect(parseInline("2 * 3 = 6")).toEqual([{ text: "2 * 3 = 6" }]);
    expect(parseInline("**열기만")).toEqual([{ text: "**열기만" }]);
    expect(parseInline("** 띄움**")).toEqual([{ text: "** 띄움**" }]);
    expect(parseInline("")).toEqual([]);
  });
});

describe("memoPreviewText", () => {
  it("shows the first line without marks", () => {
    expect(memoPreviewText("\n# **수문학** 보고서\n- 나머지")).toBe("수문학 보고서");
    expect(memoPreviewText("- [ ] ~~우유~~ 사기")).toBe("우유 사기");
    expect(memoPreviewText("  \n")).toBe("");
  });
});

describe("line offsets", () => {
  it("finds the line of an offset and a line's end", () => {
    expect(lineIndexAt("ab\ncd\nef", 4)).toBe(1);
    expect(lineIndexAt("ab\ncd", 0)).toBe(0);
    expect(lineEndOffset("ab\ncd\nef", 1)).toBe(5);
    expect(lineEndOffset("ab", 7)).toBe(2);
  });
});

describe("toggleLineFormat", () => {
  it("adds, replaces and removes a line mark, keeping the caret on its text", () => {
    expect(run(toggleLineFormat(...at("사|과"), "bullet"), "사과")).toBe("- 사|과");
    expect(run(toggleLineFormat(...at("- 사|과"), "bullet"), "- 사과")).toBe("사|과");
    expect(run(toggleLineFormat(...at("- 사|과"), "check"), "- 사과")).toBe("- [ ] 사|과");
    expect(run(toggleLineFormat(...at("# 제|목"), "h2"), "# 제목")).toBe("## 제|목");
    expect(run(toggleLineFormat(...at("|"), "check"), "")).toBe("- [ ] |");
    expect(run(toggleLineFormat(...at("  하|나"), "bullet"), "  하나")).toBe("  - 하|나");
  });

  it("formats every selected line and skips blank ones", () => {
    const [content, start, end] = at("[a\n\nb]");
    expect(run(toggleLineFormat(content, start, end, "bullet"), content)).toBe("[- a\n\n- b]");
    const [listed, s2, e2] = at("[- a\n- b]");
    expect(run(toggleLineFormat(listed, s2, e2, "bullet"), listed)).toBe("[a\nb]");
  });

  it("ignores a line that is only touched by a selection's final line break", () => {
    const [content, start, end] = at("[a\n]b");
    expect(run(toggleLineFormat(content, start, end, "bullet"), content)).toBe("[- a\n]b");
  });
});

describe("cycleHeading", () => {
  it("goes 본문 → # → ## → ### → 본문", () => {
    let content = "제목";
    const steps: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      const edit = cycleHeading(content, content.length, content.length);
      content = content.slice(0, edit.from) + edit.insert + content.slice(edit.to);
      steps.push(content);
    }
    expect(steps).toEqual(["# 제목", "## 제목", "### 제목", "제목"]);
  });
});

describe("indentSelection", () => {
  it("inserts two spaces inside plain text, like a code editor", () => {
    expect(run(indentSelection(...at("메모|내용"), false), "메모내용")).toBe("메모  |내용");
  });

  it("indents a list item or the line start a level", () => {
    expect(run(indentSelection(...at("- 항|목"), false), "- 항목")).toBe("  - 항|목");
    expect(run(indentSelection(...at("|글"), false), "글")).toBe("  |글");
  });

  it("outdents with Shift+Tab, tabs and spaces alike", () => {
    expect(run(indentSelection(...at("  - 항|목"), true), "  - 항목")).toBe("- 항|목");
    expect(run(indentSelection(...at("\t탭|"), true), "\t탭")).toBe("탭|");
    expect(run(indentSelection(...at("없|음"), true), "없음")).toBe("없|음");
  });

  it("moves every selected line", () => {
    const [content, start, end] = at("[a\nb]");
    expect(run(indentSelection(content, start, end, false), content)).toBe("[  a\n  b]");
  });
});

describe("continueList", () => {
  it("starts the next bullet, checklist item or number", () => {
    expect(run(continueList(...at("- 사과|").slice(0, 2) as [string, number]), "- 사과")).toBe("- 사과\n- |");
    expect(run(continueList("+ 배", 3), "+ 배")).toBe("+ 배\n+ |");
    expect(run(continueList("- [x] 끝", 7), "- [x] 끝")).toBe("- [x] 끝\n- [ ] |");
    expect(run(continueList("9. 아홉", 5), "9. 아홉")).toBe("9. 아홉\n10. |");
    expect(run(continueList("  - 안쪽", 6), "  - 안쪽")).toBe("  - 안쪽\n  - |");
  });

  it("moves the rest of the line into the new item", () => {
    expect(run(continueList("- 사과배", 4), "- 사과배")).toBe("- 사과\n- |배");
  });

  it("ends the list on an empty item, stepping out a level first", () => {
    expect(run(continueList("- a\n- ", 6), "- a\n- ")).toBe("- a\n|");
    expect(run(continueList("- a\n  - ", 8), "- a\n  - ")).toBe("- a\n- |");
  });

  it("handles a caret at the very start of a memo that begins with a blank line", () => {
    expect(continueList("\n- a", 0)).toBeNull();
    expect(run(toggleLineFormat("\nb", 0, 0, "bullet"), "\nb")).toBe("- |\nb");
  });

  it("leaves plain lines, headings and a caret inside the mark alone", () => {
    expect(continueList("그냥 글", 4)).toBeNull();
    expect(continueList("# 제목", 4)).toBeNull();
    expect(continueList("- 사과", 1)).toBeNull();
  });
});

describe("toggleInlineMark", () => {
  it("wraps a selection and unwraps it again", () => {
    const [content, start, end] = at("a [굵게] b");
    expect(run(toggleInlineMark(content, start, end, "**"), content)).toBe("a [**굵게**] b");
    const [wrapped, s2, e2] = at("a [**굵게**] b");
    expect(run(toggleInlineMark(wrapped, s2, e2, "**"), wrapped)).toBe("a [굵게] b");
  });

  it("unwraps when the marks sit just outside the selection", () => {
    const [content, start, end] = at("~~[끝]~~");
    expect(run(toggleInlineMark(content, start, end, "~~"), content)).toBe("[끝]");
  });

  it("keeps spaces outside the marks and handles each line", () => {
    const [content, start, end] = at("[ 앞 \n뒤]");
    expect(run(toggleInlineMark(content, start, end, "*"), content)).toBe("[ *앞* \n*뒤*]");
  });

  it("puts the caret between new marks when nothing is selected", () => {
    expect(run(toggleInlineMark(...at("a|"), "**"), "a")).toBe("a**|**");
  });

  it("doesn't treat bold as italic", () => {
    const [content, start, end] = at("**[굵게]**");
    expect(run(toggleInlineMark(content, start, end, "*"), content)).toBe("**[*굵게*]**");
  });
});

describe("toggleChecklistLine", () => {
  it("flips only the chosen line and keeps its marker and indent", () => {
    expect(toggleChecklistLine("- [ ] a\n  + [x] b\nc", 1)).toBe("- [ ] a\n  + [ ] b\nc");
    expect(toggleChecklistLine("- [ ] a", 0)).toBe("- [x] a");
    expect(toggleChecklistLine("그냥", 0)).toBe("그냥");
  });
});
