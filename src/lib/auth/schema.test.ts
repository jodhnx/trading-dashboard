import { describe, expect, it } from "vitest";
import { loginSchema } from "./schema";

describe("login validation", () => {
  it("accepts a valid email and password", () => {
    const parsed = loginSchema.safeParse({
      email: "trader@example.com",
      password: "long-enough",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid emails and short passwords", () => {
    expect(loginSchema.safeParse({ email: "nope", password: "long-enough" }).success).toBe(
      false,
    );
    expect(
      loginSchema.safeParse({ email: "trader@example.com", password: "short" }).success,
    ).toBe(false);
  });
});
