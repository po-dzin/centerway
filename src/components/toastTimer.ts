export type ToastTimer = {
  pause: (reason: string) => void;
  resume: (reason: string) => void;
  dispose: () => void;
};

/** Independent pause reasons prevent pointer-leave expiring a focused toast. */
export function createToastTimer(expire: () => void, durationMs: number): ToastTimer {
  let remaining = durationMs;
  let started = 0;
  let handle: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  const paused = new Set<string>();
  const start = () => {
    if (disposed || paused.size || handle !== undefined || durationMs <= 0 || !Number.isFinite(durationMs)) return;
    started = Date.now();
    handle = setTimeout(() => { disposed = true; expire(); }, Math.max(0, remaining));
  };
  start();
  return {
    pause(reason) {
      paused.add(reason);
      if (handle !== undefined) {
        clearTimeout(handle);
        handle = undefined;
        remaining -= Date.now() - started;
      }
    },
    resume(reason) { paused.delete(reason); start(); },
    dispose() { disposed = true; clearTimeout(handle); },
  };
}
