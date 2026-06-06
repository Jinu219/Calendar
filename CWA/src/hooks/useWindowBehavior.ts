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
    invoke("set_window_level", { level: windowLevel }).catch(console.error);
  }, [windowLevel]);

  useEffect(() => {
    invoke("set_show_on_taskbar", { show: showOnTaskbar }).catch(console.error);
  }, [showOnTaskbar]);
};