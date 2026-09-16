import { useCallback, useState } from "react";

interface UseTodoPanelResizeParams {
  editMode: boolean;
  todoPanelWidth: number;
  setTodoPanelWidth: (width: number) => void;
}

export const useTodoPanelResize = ({
  editMode,
  todoPanelWidth,
  setTodoPanelWidth,
}: UseTodoPanelResizeParams) => {
  const [isResizing, setIsResizing] = useState(false);

  const startResize = useCallback((e: React.MouseEvent) => {
    if (!editMode) return;

    e.preventDefault();
    e.stopPropagation();

    setIsResizing(true);

    const startX = e.clientX;
    const startW = todoPanelWidth;

    const onMove = (ev: MouseEvent) => {
      const nextWidth = Math.max(
        200,
        Math.min(480, startW + (startX - ev.clientX))
      );

      setTodoPanelWidth(nextWidth);
    };

    const onUp = () => {
      setIsResizing(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [editMode, todoPanelWidth, setTodoPanelWidth]);

  return {
    isResizing,
    startResize,
  };
};