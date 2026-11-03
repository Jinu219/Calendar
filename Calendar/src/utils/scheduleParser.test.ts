import { describe, expect, it } from "vitest";
import { parseScheduleText, type ScheduleParseContext } from "./scheduleParser";
import { parseInboxEvent } from "./inboxUtils";

// 2026-11-03 is a Tuesday; the user has 11/5 (Thu) selected.
const ctx: ScheduleParseContext = { today: "2026-11-03", selectedDate: "2026-11-05", defaultKind: "schedule" };
const parse = (text: string, overrides: Partial<ScheduleParseContext> = {}) => parseScheduleText(text, { ...ctx, ...overrides });

describe("times (the old quick add)", () => {
  it.each([
    ["14:30 회의", { title: "회의", time: "14:30", endTime: "15:30" }],
    ["오후 3시 반 미팅", { title: "미팅", time: "15:30", endTime: "16:30" }],
    ["회의 14:00~15:30", { title: "회의", time: "14:00", endTime: "15:30" }],
    ["오후 2시~4시 스터디", { title: "스터디", time: "14:00", endTime: "16:00" }],
    ["3시 치과", { title: "치과", time: "15:00", endTime: "16:00" }],
    ["오전 9시 운동", { title: "운동", time: "09:00", endTime: "10:00" }],
    ["23:30 정리", { title: "정리", time: "23:30", endTime: "23:59" }],
    ["저녁 7시 약속", { title: "약속", time: "19:00", endTime: "20:00" }],
    ["3시부터 5시까지 세미나", { title: "세미나", time: "15:00", endTime: "17:00" }],
    ["정오 점심", { title: "점심", time: "12:00", endTime: "13:00" }],
    ["3시 반복 점검", { title: "반복 점검", time: "15:00", endTime: "16:00" }],
    ["3시반에 통화", { title: "통화", time: "15:30", endTime: "16:30" }],
  ])("%s", (input, expected) => {
    expect(parse(input).event).toMatchObject({ ...expected, date: "2026-11-05", kind: "schedule" });
  });

  it.each(["2시간 공부", "3월 보고서", "14:00", "3시험 대비"])("leaves %s as a plain title", input => {
    const result = parse(input);
    expect(result.event).toEqual({ title: input, date: "2026-11-05", kind: "schedule" });
    expect(result.recognized).toBe(false);
  });
});

describe("dates", () => {
  it.each([
    ["내일 치과", "2026-11-04"],
    ["모레 3시 치과", "2026-11-05"],
    ["오늘 저녁 7시 약속", "2026-11-03"],
    ["3일 뒤 회의", "2026-11-06"],
    ["다음 주 화요일 3시 치과", "2026-11-10"],
    ["다음주 금 회식", "2026-11-13"],
    ["이번 주 금요일 회식", "2026-11-06"],
    ["금요일 발표", "2026-11-06"],
    ["화요일 회의", "2026-11-03"],
    ["이번 주말 등산", "2026-11-07"],
    ["11월 20일 시험", "2026-11-20"],
    ["11/20 시험", "2026-11-20"],
    ["2027-01-02 여행", "2027-01-02"],
    ["1/5 개강", "2027-01-05"],
    ["15일 월급", "2026-11-15"],
    ["1일 회비", "2026-12-01"],
    ["다음 달 3일 정기점검", "2026-12-03"],
  ])("%s → %s", (input, date) => {
    const result = parse(input);
    expect(result.event.date).toBe(date);
    expect(result.recognized).toBe(true);
  });

  it("reads a range", () => {
    expect(parse("11/11~11/13 대동제").event).toMatchObject({ title: "대동제", date: "2026-11-11", endDate: "2026-11-13" });
    expect(parse("내일부터 금요일까지 출장").event).toMatchObject({ title: "출장", date: "2026-11-04", endDate: "2026-11-06" });
  });

  it("treats 'X까지' as a deadline", () => {
    expect(parse("금요일까지 보고서 제출").event).toMatchObject({ title: "보고서 제출", date: "2026-11-06", kind: "todo" });
    expect(parse("내일 6시까지 과제 제출").event).toMatchObject({ title: "과제 제출", date: "2026-11-04", time: "18:00", kind: "todo" });
    expect(parse("내일 6시까지 과제 제출").event.endTime).toBeUndefined();
  });

  it("doesn't take words that only look like dates", () => {
    expect(parse("보낼 메일 정리").event.title).toBe("보낼 메일 정리");
    expect(parse("다음 주 수학 과외").event.title).toBe("다음 주 수학 과외");
  });
});

describe("repeats", () => {
  it("reads weekly days and an end date", () => {
    const { event, understood } = parse("매주 월수금 7시 헬스 12월 31일까지");
    // 7–12시 without 오전/오후 stay in the morning (1–6시 mean the afternoon).
    expect(event).toMatchObject({
      title: "헬스",
      date: "2026-11-06",
      time: "07:00",
      repeat: "weekly",
      repeatDays: [1, 3, 5],
      repeatUntil: "2026-12-31",
    });
    expect(understood).toContain("매주 월·수·금 (~12/31(목))");
  });

  it.each([
    ["매일 아침 8시 약 먹기", { repeat: "daily", time: "08:00" }],
    ["평일 9시 출근", { repeat: "weekdays", time: "09:00" }],
    ["격주 화요일 동아리", { repeat: "weekly", repeatInterval: 2, repeatDays: [2] }],
    ["화목마다 수영", { repeat: "weekly", repeatDays: [2, 4] }],
    ["3일마다 물주기", { repeat: "daily", repeatInterval: 3 }],
    ["매달 25일 월급", { repeat: "monthly", date: "2026-11-25" }],
    ["매년 3월 5일 생일", { repeat: "yearly", date: "2027-03-05" }],
  ])("%s", (input, expected) => {
    expect(parse(input).event).toMatchObject(expected);
  });
});

describe("the rest", () => {
  it("reads reminders, categories and the todo prefix", () => {
    expect(parse("내일 3시 치과 30분 전 알림").event).toMatchObject({ title: "치과", reminderMinutes: 30 });
    expect(parse("회의 1시간 전 알림").event.reminderMinutes).toBe(60);
    expect(parse("회의 알림 없이").event.reminderMinutes).toBeNull();
    expect(parse("수업 복습 #수업").event).toMatchObject({ title: "수업 복습", category: "수업" });
    expect(parse("할 일: 장보기").event).toMatchObject({ title: "장보기", kind: "todo" });
    expect(parse("보고서 마감 금요일").event).toMatchObject({ title: "보고서 마감", kind: "todo" });
  });

  it("drops requests and leftover particles from the title", () => {
    expect(parse("다음 주 화요일에 치과 일정 추가해줘").event.title).toBe("치과");
    expect(parse("3시에 치과 넣어줘").event.title).toBe("치과");
  });

  it("gives due times to todos in todo mode", () => {
    expect(parse("6시 장보기", { defaultKind: "todo" }).event).toEqual({ title: "장보기", date: "2026-11-05", kind: "todo", time: "18:00" });
  });

  it("always produces something parseInboxEvent accepts", () => {
    for (const text of ["매주 월수금 7시 헬스 12월 31일까지", "11/11~11/13 대동제 #축제", "금요일까지 보고서", "격주 화요일 동아리"]) {
      expect(parseInboxEvent(parse(text).event, { "#a5f3fc": "축제" }).ok).toBe(true);
    }
  });
});
