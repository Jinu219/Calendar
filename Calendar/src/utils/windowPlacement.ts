// ═══════════════════════════════════════════════════════════
// Window placement across monitors with different scaling
// ═══════════════════════════════════════════════════════════
//
// `window.screen` only describes the primary monitor, in CSS pixels, so it
// misplaces windows on a second monitor or a monitor with another 배율. These
// helpers work in physical pixels against the monitor the window lands on.

import { PhysicalPosition } from "@tauri-apps/api/dpi";
import { availableMonitors, currentMonitor, type Monitor } from "@tauri-apps/api/window";

const MARGIN_LOGICAL = 8;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

const monitorAt = (monitors: Monitor[], x: number, y: number): Monitor | undefined =>
  monitors.find(({ position, size }) =>
    x >= position.x && x < position.x + size.width && y >= position.y && y < position.y + size.height
  );

/**
 * A physical position for a window of the given logical size, as close to
 * (x, y) as possible while staying inside that monitor's work area (taskbar excluded).
 */
export async function fitOnScreen(
  x: number,
  y: number,
  logicalWidth: number,
  logicalHeight: number
): Promise<PhysicalPosition> {
  const monitors = await availableMonitors().catch(() => [] as Monitor[]);
  const monitor = monitorAt(monitors, x, y) ?? (await currentMonitor().catch(() => null)) ?? monitors[0];

  if (!monitor) return new PhysicalPosition(Math.round(x), Math.round(y));

  const { position, size } = monitor.workArea ?? { position: monitor.position, size: monitor.size };
  const scale = monitor.scaleFactor || 1;
  const margin = MARGIN_LOGICAL * scale;

  return new PhysicalPosition(
    Math.round(clamp(x, position.x + margin, position.x + size.width - logicalWidth * scale - margin)),
    Math.round(clamp(y, position.y + margin, position.y + size.height - logicalHeight * scale - margin))
  );
}

/** A mouse event's screen point in physical pixels. */
export const screenPointOf = (event: { screenX: number; screenY: number }) => ({
  x: event.screenX * window.devicePixelRatio,
  y: event.screenY * window.devicePixelRatio,
});
