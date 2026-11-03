import { describe, expect, it } from "vitest";
import { computeKoreanHolidays } from "./holidayUtils";

describe("Korean public holidays", () => {
  it("gives no substitute when 설/추석 only touch a Saturday", () => {
    // 2026 추석: 9/24 (Thu) – 9/26 (Sat).
    expect(computeKoreanHolidays(2026)["2026-09-28"]).toBeUndefined();
  });

  it("substitutes weekend national holidays (2026)", () => {
    const holidays = computeKoreanHolidays(2026);
    expect(holidays["2026-03-02"]).toBe("삼일절 대체공휴일");
    expect(holidays["2026-05-25"]).toBe("부처님오신날 대체공휴일");
    expect(holidays["2026-08-17"]).toBe("광복절 대체공휴일");
    expect(holidays["2026-10-05"]).toBe("개천절 대체공휴일");
    expect(holidays["2026-06-03"]).toBe("전국동시지방선거");
  });

  it("gives one substitute for two holidays on the same day (2025)", () => {
    const holidays = computeKoreanHolidays(2025);
    expect(holidays["2025-05-06"]).toBe("어린이날 대체공휴일");
    expect(holidays["2025-05-07"]).toBeUndefined();
    expect(holidays["2025-10-08"]).toBe("추석 대체공휴일");
  });

  it("covers 설날 on a weekend and 성탄절 on a Saturday (2027)", () => {
    const holidays = computeKoreanHolidays(2027);
    expect(holidays["2027-02-09"]).toBe("설날 대체공휴일");
    expect(holidays["2027-12-27"]).toBe("성탄절 대체공휴일");
  });

  it("substitutes 추석 overlapping 개천절 (2028)", () => {
    const holidays = computeKoreanHolidays(2028);
    expect(holidays["2028-10-05"]).toBe("추석 대체공휴일");
    expect(holidays["2028-10-06"]).toBeUndefined();
  });

  it("knows the lunar holidays of later years", () => {
    const holidays = computeKoreanHolidays(2035);
    expect(Object.values(holidays)).toContain("설날");
    expect(Object.values(holidays)).toContain("추석");
    expect(Object.values(holidays)).toContain("부처님오신날");
  });
});
