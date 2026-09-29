import { describe, expect, it, vi } from "vitest";
import { createActionRunner } from "./action";

describe("UI save lifecycle", () => {
  it("prevents a second write while the first is pending", async () => {
    const run = createActionRunner();
    let finish!: () => void;
    const write = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const first = run(write, async () => {}, () => {});
    expect(await run(write, async () => {}, () => {})).toEqual({ kind: "busy" });
    expect(write).toHaveBeenCalledTimes(1);
    finish();
    expect(await first).toEqual({ kind: "success" });
  });
  it("does not dismiss the form or reload after a failed write and permits retry", async () => {
    const run = createActionRunner();
    const saved = vi.fn();
    const reload = vi.fn();
    const error = new Error("Нет связи");
    expect(await run(async () => { throw error; }, reload, saved)).toEqual({ kind: "error", error });
    expect(saved).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(await run(async () => {}, reload, saved)).toEqual({ kind: "success" });
  });
  it("reports a saved write separately from a failed reload", async () => {
    const saved = vi.fn();
    const error = new Error("Нет связи");
    const result = await createActionRunner()(async () => {}, async () => { throw error; }, saved);
    expect(result).toEqual({ kind: "refresh-error", error });
    expect(saved).toHaveBeenCalledTimes(1);
  });
});
