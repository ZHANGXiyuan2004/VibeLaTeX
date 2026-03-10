import { clearErrorsForTests, getRecentErrors, logError } from "@/server/error-log";

describe("error-log", () => {
  beforeEach(() => {
    clearErrorsForTests();
  });

  it("stores and returns recent errors", () => {
    logError("scope-a", "first");
    logError("scope-b", "second");

    const errors = getRecentErrors();
    expect(errors).toHaveLength(2);
    expect(errors[0]?.message).toBe("second");
    expect(errors[1]?.message).toBe("first");
  });

  it("respects limit", () => {
    logError("scope", "one");
    logError("scope", "two");

    const errors = getRecentErrors(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toBe("two");
  });
});
