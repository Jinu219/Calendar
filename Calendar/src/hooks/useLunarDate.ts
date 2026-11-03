import { useMemo } from "react";
import { getLunarDateString, parseLocalDate } from "../utils";

/** The selected day's lunar date, when the 음력 setting is on. */
export const useLunarDate = (selectedDate: string, useLunar: boolean): string =>
  useMemo(
    () => (useLunar ? getLunarDateString(parseLocalDate(selectedDate)) : ""),
    [selectedDate, useLunar]
  );
