import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { WindowLevel } from "../types";

interface UseWindowBehaviorParams {
  windowLevel: WindowLevel;
  showOnTaskbar: boolean;
}

export const useWindowBehavior = ({
  windowLevel,
  showOnTaskbar,
}: UseWindowBehaviorParams) => {
  useEffect(() => {
    invoke<boolean>("set_window_level", { level: windowLevel })
      .catch(error => console.error("Failed to update window level:", error));
  }, [windowLevel]);

  useEffect(() => {
    invoke<boolean>("set_show_on_taskbar", { show: showOnTaskbar })
      .catch(error => console.error("Failed to update taskbar visibility:", error));
  }, [showOnTaskbar]);
};
