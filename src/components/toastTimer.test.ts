import { afterEach, describe, expect, it, vi } from "vitest";
import { createToastTimer } from "./toastTimer";

afterEach(() => vi.useRealTimers());
describe("shared notification clock", () => {
  it("expires once after the shared duration", () => {
    vi.useFakeTimers();
    const expire = vi.fn();
    const clock = createToastTimer(expire, 5000);
    vi.advanceTimersByTime(4999);
    expect(expire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    clock.resume("focus");
    vi.advanceTimersByTime(5000);
    expect(expire).toHaveBeenCalledTimes(1);
  });
  it("retains remaining time and waits for every pause reason", () => {
    vi.useFakeTimers();
    const expire = vi.fn();
    const clock = createToastTimer(expire, 5000);
    vi.advanceTimersByTime(2000);
    clock.pause("pointer");
    clock.pause("focus");
    clock.pause("hidden");
    vi.advanceTimersByTime(10000);
    clock.resume("pointer");
    clock.resume("hidden");
    vi.advanceTimersByTime(10000);
    expect(expire).not.toHaveBeenCalled();
    clock.resume("focus");
    vi.advanceTimersByTime(2999);
    expect(expire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(expire).toHaveBeenCalledTimes(1);
  });
  it("cancels pending work on dismissal or unmount", () => {
    vi.useFakeTimers();
    const expire = vi.fn();
    const clock = createToastTimer(expire, 5000);
    clock.dispose();
    clock.resume("focus");
    vi.advanceTimersByTime(10000);
    expect(expire).not.toHaveBeenCalled();
  });
  it("allows explicitly persistent notices", () => {
    vi.useFakeTimers();
    const expire = vi.fn();
    const clock = createToastTimer(expire, 0);
    clock.pause("pointer");
    clock.resume("pointer");
    vi.advanceTimersByTime(100000);
    expect(expire).not.toHaveBeenCalled();
    clock.dispose();
  });
});
