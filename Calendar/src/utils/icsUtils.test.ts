import { describe, expect, it } from "vitest";
import { listOccurrenceStarts } from "./todoUtils";
import { parseIcs } from "./icsUtils";

const wrap = (body: string) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", body.trim(), "END:VCALENDAR"].join("\r\n");

const source = { id: "school", color: "#c4b5fd" };

describe("ICS parsing", () => {
  it("reads all-day events with an exclusive end", () => {
    const [todo] = parseIcs(wrap(`
BEGIN:VEVENT
UID:exam
SUMMARY:중간고사 기간
DTSTART;VALUE=DATE:20261019
DTEND;VALUE=DATE:20261024
END:VEVENT`), source);

    expect(todo).toMatchObject({
      id: "school:exam",
      sourceId: "school",
      title: "중간고사 기간",
      allDay: true,
      startDate: "2026-10-19",
      endDate: "2026-10-23",
      repeat: "none",
    });
  });

  it("converts UTC and TZID times to local time", () => {
    const todos = parseIcs(wrap(`
BEGIN:VEVENT
UID:utc
SUMMARY:UTC 회의
DTSTART:20261103T050000Z
DTEND:20261103T060000Z
END:VEVENT
BEGIN:VEVENT
UID:ny
SUMMARY:뉴욕 회의
DTSTART;TZID=America/New_York:20261103T090000
DTEND;TZID=America/New_York:20261103T100000
END:VEVENT`), source);

    const expected = (iso: string) => {
      const d = new Date(iso);
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    };

    expect(todos[0].startTime).toBe(expected("2026-11-03T05:00:00Z"));
    // 09:00 in New York on Nov 3 2026 (EST, UTC-5) is 14:00 UTC.
    expect(todos[1].startTime).toBe(expected("2026-11-03T14:00:00Z"));
  });

  it("maps weekly rules, EXDATE and moved instances", () => {
    const todos = parseIcs(wrap(`
BEGIN:VEVENT
UID:class
SUMMARY:대기역학 수업
DTSTART:20261102T090000
DTEND:20261102T103000
RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261130T235959Z
EXDATE:20261104T090000
END:VEVENT
BEGIN:VEVENT
UID:class
RECURRENCE-ID:20261111T090000
SUMMARY:대기역학 수업 (보강)
DTSTART:20261113T090000
DTEND:20261113T103000
END:VEVENT`), source);

    const series = todos.find(t => t.repeat === "weekly")!;
    expect(series.repeatDays).toEqual([1, 3]);
    expect(listOccurrenceStarts(series, "2026-11-01", "2026-11-14"))
      .toEqual(["2026-11-02", "2026-11-09"]);
    expect(todos.find(t => t.repeat === "none")?.startDate).toBe("2026-11-13");
  });

  it("turns COUNT into an end date and skips cancelled events", () => {
    const todos = parseIcs(wrap(`
BEGIN:VEVENT
UID:study
SUMMARY:스터디\\, 3회
DTSTART;VALUE=DATE:20261101
RRULE:FREQ=DAILY;INTERVAL=2;COUNT=3
END:VEVENT
BEGIN:VEVENT
UID:gone
SUMMARY:취소됨
STATUS:CANCELLED
DTSTART;VALUE=DATE:20261101
END:VEVENT`), source);

    expect(todos).toHaveLength(1);
    expect(todos[0].title).toBe("스터디, 3회");
    expect(todos[0].repeatEndDate).toBe("2026-11-05");
  });

  it("unfolds continued lines", () => {
    const [todo] = parseIcs(wrap(
      "BEGIN:VEVENT\r\nUID:long\r\nSUMMARY:아주 긴 제\r\n 목\r\nDTSTART;VALUE=DATE:20261101\r\nEND:VEVENT"
    ), source);

    expect(todo.title).toBe("아주 긴 제목");
  });
});
