import { useEffect, useMemo, useState } from "react";
import { FALLBACK_FONTS } from "../constants";

export function useSystemFonts() {
  const [systemFonts, setSystemFonts] = useState<string[]>([...FALLBACK_FONTS]);
  const [fontSearch, setFontSearch] = useState("");

  useEffect(() => {
    let active = true;

    const loadFonts = async () => {
      if (!window.queryLocalFonts) return;

      try {
        const fonts = await window.queryLocalFonts();
        const names = [...new Set(fonts.map(font => font.family))].sort();

        if (active && names.length > 0) {
          setSystemFonts(names);
        }
      } catch {
        // The browser can deny local font access; fallback fonts remain available.
      }
    };

    void loadFonts();

    return () => {
      active = false;
    };
  }, []);

  const filteredFonts = useMemo(() => {
    const query = fontSearch.trim().toLocaleLowerCase("ko-KR");

    if (!query) return systemFonts;

    return systemFonts.filter(font =>
      font.toLocaleLowerCase("ko-KR").includes(query)
    );
  }, [fontSearch, systemFonts]);

  return {
    fontSearch,
    setFontSearch,
    filteredFonts,
  };
}
