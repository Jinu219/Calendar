import { useEffect, useState } from "react";
import { getLunarDateString } from "../utils";
import type { MoonPhase } from "../types";

export const useMoonAndLunar = (
  selectedDate: string,
  useLunar: boolean
) => {
  const [moonPhase, setMoonPhase] = useState<MoonPhase>({
    name: "",
    emoji: "",
  });

  const [lunarDate, setLunarDate] = useState("");

  useEffect(() => {
    let mounted = true;

    import("../utils/apiUtils")
      .then(({ fetchMoonPhase }) => fetchMoonPhase())
      .then(phase => {
        if (mounted) {
          setMoonPhase(phase);
        }
      })
      .catch(console.error);

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!useLunar) {
      setLunarDate("");
      return;
    }

    const date = new Date(`${selectedDate}T00:00:00`);
    setLunarDate(getLunarDateString(date));
  }, [selectedDate, useLunar]);

  return {
    moonPhase,
    lunarDate,
  };
};