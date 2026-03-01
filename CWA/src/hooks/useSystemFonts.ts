// ═══════════════════════════════════════════════════════════
// useSystemFonts Hook
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from "react";
import { FALLBACK_FONTS } from "../constants";

export function useSystemFonts() {
  const [systemFonts, setSystemFonts] = useState<string[]>(FALLBACK_FONTS);
  const [fontSearch, setFontSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        if ("queryLocalFonts" in window) {
          const fonts = await (window as any).queryLocalFonts();
          const names: string[] = [...new Set<string>(
            fonts.map((f: any) => f.family as string)
          )].sort();
          setSystemFonts(names);
        }
      } catch {
        // Fallback already set
      }
    })();
  }, []);

  const filteredFonts = systemFonts.filter(f => 
    f.toLowerCase().includes(fontSearch.toLowerCase())
  );

  return {
    systemFonts,
    fontSearch,
    setFontSearch,
    filteredFonts,
  };
}
