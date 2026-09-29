// Keep the write and the following reload separate: a failed reload must not
// encourage the user to submit an already completed write again.
export function createActionRunner() {
  let running = false;
  return async (write: () => Promise<unknown>, reload: () => Promise<unknown>, saved: () => void) => {
    if (running) return { kind: "busy" as const };
    running = true;
    try {
      try { await write(); } catch (error) { return { kind: "error" as const, error }; }
      saved();
      try { await reload(); } catch (error) { return { kind: "refresh-error" as const, error }; }
      return { kind: "success" as const };
    } finally { running = false; }
  };
}
