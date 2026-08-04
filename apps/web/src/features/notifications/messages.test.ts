// What Slack is told, and what it can never be made to do (spec 203).
//
// Half of these are about escaping, and that half is the reason this file exists at all. Workspace
// and project names are whatever a founder typed into a form (§III), and Slack's mrkdwn reads `<…>`
// as a link or a command — so an unescaped name is a stranger deciding what our internal channel
// does. `<!channel>` pings everyone; `<https://evil.example|Payment failed>` renders as a link
// somebody in a hurry might click.
import { describe, it, expect } from "vitest";
import {
  escapeSlack,
  foundationGeneratedMessage,
  paidMessage,
  userCreatedMessage
} from "./messages";

describe("escapeSlack", () => {
  it("neutralises a name that would ping the whole channel", () => {
    expect(escapeSlack("<!channel>")).toBe("&lt;!channel&gt;");
  });

  it("neutralises a name that would render as a link", () => {
    expect(escapeSlack("<https://evil.example|Payment failed>")).toBe(
      "&lt;https://evil.example|Payment failed&gt;"
    );
  });

  it("escapes the ampersand first, so an escape cannot be double-encoded into a new one", () => {
    // `&lt;` arriving as literal text must survive as `&amp;lt;`, not collapse back into `<`.
    expect(escapeSlack("A & B")).toBe("A &amp; B");
    expect(escapeSlack("&lt;")).toBe("&amp;lt;");
  });

  it("leaves an ordinary name alone", () => {
    expect(escapeSlack("Pied Piper")).toBe("Pied Piper");
  });

  it("truncates a very long name rather than flooding the channel", () => {
    const long = "x".repeat(500);

    expect(escapeSlack(long)).toHaveLength(81); // 80 characters plus the ellipsis
    expect(escapeSlack(long).endsWith("…")).toBe(true);
  });

  it("truncates after escaping, so the cut never lands inside an entity", () => {
    // Cutting first could leave `&a` or `&l` behind, which Slack renders as literal noise.
    const name = `${"<".repeat(40)}`;

    expect(escapeSlack(name)).not.toMatch(/&[a-z]*$/);
  });
});

describe("userCreatedMessage", () => {
  it("names the workspace and how they signed in", () => {
    expect(userCreatedMessage("Pied Piper", "github")).toBe(
      "🎉 New account — *Pied Piper* signed up with GitHub."
    );
  });

  it("reads a method it does not recognise rather than dropping it", () => {
    expect(userCreatedMessage("Pied Piper", "saml")).toContain("saml");
  });

  it("still says something when the workspace has no name", () => {
    // A notification beats a blank. This is a real state: the read can race a fresh signup.
    expect(userCreatedMessage(null, "email")).toContain("(unnamed)");
  });
});

describe("foundationGeneratedMessage", () => {
  it("names both the workspace and the project", () => {
    const message = foundationGeneratedMessage("Acme", "CRM", false);

    expect(message).toContain("Acme");
    expect(message).toContain("CRM");
    expect(message).toContain("generated a foundation");
  });

  it("says plainly when it was a regeneration", () => {
    // Founders regenerate constantly while tuning one answer. A channel that read the same either
    // way would make a busy afternoon look like ten new customers.
    const message = foundationGeneratedMessage("Acme", "CRM", true);

    expect(message).toContain("regenerated");
    expect(message).not.toContain("generated a foundation");
  });

  it("escapes the project name too, not only the workspace", () => {
    expect(foundationGeneratedMessage("Acme", "<!here>", false)).toContain("&lt;!here&gt;");
    expect(foundationGeneratedMessage("Acme", "<!here>", false)).not.toContain("<!here>");
  });

  it("treats a whitespace-only name as no name", () => {
    expect(foundationGeneratedMessage("Acme", "   ", false)).toContain("(unnamed)");
  });
});

describe("paidMessage", () => {
  it("says which plan was bought", () => {
    expect(paidMessage("Acme", "monthly")).toBe("💚 *Acme* bought Pro — monthly.");
    expect(paidMessage("Acme", "yearly")).toContain("yearly");
  });

  it("calls a founding place what it is", () => {
    // The capped launch offer (spec 179) is the one worth noticing in a channel.
    expect(paidMessage("Acme", "founding")).toContain("a founding place");
  });

  it("still announces the payment when the workspace could not be read", () => {
    expect(paidMessage(null, "founding")).toContain("a founding place");
  });
});

describe("what is never in a message", () => {
  it("carries no email address, because a Slack history is searchable and retained", () => {
    // The closed list is the security property. If a builder ever gains an argument, this is the
    // test that should make somebody stop and think about where it ends up.
    const all = [
      userCreatedMessage("Acme", "email"),
      foundationGeneratedMessage("Acme", "CRM", false),
      paidMessage("Acme", "founding")
    ].join(" ");

    expect(all).not.toMatch(/@/);
  });
});
