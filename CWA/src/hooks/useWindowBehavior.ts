import { useEffect, useMemo } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";

interface UseWindowBehaviorParams {
  alwaysOnTop: boolean;
  showOnTaskbar: boolean;
}

export const useWindowBehavior = ({
  alwaysOnTop,
  showOnTaskbar,
}: UseWindowBehaviorParams) => {
  const appWin = useMemo(() => getCurrentWindow(), []);

  useEffect(() => {
    if (alwaysOnTop) {
      invoke("set_always_on_top", { enabled: true }).catch(console.error);
      return;
    }

    invoke("set_always_on_top", { enabled: false }).catch(console.error);

    const pushToBottom = () => {
      invoke("set_always_on_bottom", {}).catch(console.error);
    };

    pushToBottom();

    const unlistenPromise = appWin.onFocusChanged(({ payload: focused }) => {
      if (!focused) {
        pushToBottom();
      }
    });

    return () => {
      unlistenPromise.then(unlisten => unlisten()).catch(console.error);
    };
  }, [appWin, alwaysOnTop]);

  useEffect(() => {
    invoke("set_show_on_taskbar", { show: showOnTaskbar }).catch(console.error);
  }, [showOnTaskbar]);
};