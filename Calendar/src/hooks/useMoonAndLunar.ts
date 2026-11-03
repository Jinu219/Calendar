import { useMemo } from "react";
import { calculateMoonPhase, getLunarDateString, parseLocalDate } from "../utils";

export const useMoonAndLunar = (
  today: string,
  selectedDate: string,
  useLunar: boolean
) => {
  // Evaluated at noon so the phase reflects the day rather than midnight.
  const moonPhase = useMemo(() => {
    const noon = parseLocalDate(today);
    noon.setHours(12);
    return calculateMoonPhase(noon);
  }, [today]);

  const lunarDate = useMemo(
    () => (useLunar ? getLunarDateString(parseLocalDate(selectedDate)) : ""),
    [selectedDate, useLunar]
  );

  return {
    moonPhase,
    lunarDate,
  };
};
