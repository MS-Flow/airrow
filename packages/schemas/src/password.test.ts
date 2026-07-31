// What a new password must contain, and — just as important — what an old one still may (spec 140).
import { describe, expect, it } from "vitest";
import { loginSchema, PASSWORD_RULES, signupSchema, unmetPasswordRules } from "./index";

const signup = (password: string, confirmPassword = password) =>
  signupSchema.safeParse({
    name: "Ada Lovelace",
    email: "ada@example.com",
    password,
    confirmPassword
  });

const STRONG = "Correct-Horse9";

describe("unmetPasswordRules", () => {
  it("names every rule an empty password fails", () => {
    expect(unmetPasswordRules("")).toEqual(PASSWORD_RULES.map((rule) => rule.id));
  });

  it("names nothing for a password that satisfies them all", () => {
    expect(unmetPasswordRules(STRONG)).toEqual([]);
  });

  it.each([
    ["Sh0rt!a", "length"],
    ["ALLCAPS123!", "lowercase"],
    ["nocaps123!", "uppercase"],
    ["NoDigits!!", "number"]
  ])("%s is missing %s and says so", (password, missing) => {
    expect(unmetPasswordRules(password)).toEqual([missing]);
  });

  /*
   * A symbol used to be required and no longer is (spec 140): the rule reliably produced `Passw0rd!` —
   * a word with a predictable suffix — while the passphrase without one is the better password. The
   * signup form's zxcvbn gate judges that properly; a regex never could.
   */
  it("accepts a password with no special character at all", () => {
    expect(unmetPasswordRules("NoSpecial123")).toEqual([]);
  });
});

describe("signupSchema", () => {
  it("accepts a password that meets every rule", () => {
    expect(signup(STRONG).success).toBe(true);
  });

  it.each(["Sh0rt!a", "ALLCAPS123!", "nocaps123!", "NoDigits!!"])(
    "refuses %s, which the checklist would still show as unfinished",
    (password) => {
      expect(signup(password).success).toBe(false);
    }
  );

  it("accepts a password whose only omission is a special character", () => {
    expect(signup("NoSpecial123").success).toBe(true);
  });

  /*
   * The checklist and the schema are the same list read twice, and this is what stops them drifting: the
   * schema accepts a password exactly when the checklist has no items left. A boundary where the browser
   * and the server disagree is the one bug this design exists to make impossible.
   */
  it.each(["", "abc", "Sh0rt!a", "NoSpecial123", "Correct-Horse9", "aA1!aA1!"])(
    "accepts %s exactly when the checklist is complete",
    (password) => {
      expect(signup(password).success).toBe(unmetPasswordRules(password).length === 0);
    }
  );

  it("refuses a repeat that does not match, and points at the field the founder retypes", () => {
    const result = signup(STRONG, `${STRONG}x`);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((issue) => issue.path[0] === "confirmPassword")).toBe(true);
  });

  it("does not treat a matching pair as a mismatch", () => {
    const result = signup(STRONG, STRONG);
    expect(result.success).toBe(true);
  });
});

describe("loginSchema", () => {
  /*
   * The regression this spec must not cause. Accounts created before the class requirements existed have
   * passwords that fail every one of them; tightening signup must never tighten the rule that lets those
   * founders back in.
   */
  it.each(["password", "12345678", "oldweakpw"])(
    "still accepts %s, because an existing account uses it",
    (password) => {
      expect(loginSchema.safeParse({ email: "ada@example.com", password }).success).toBe(true);
    }
  );

  it("still refuses a password shorter than the floor", () => {
    expect(loginSchema.safeParse({ email: "ada@example.com", password: "short" }).success).toBe(false);
  });
});
