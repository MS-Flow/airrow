// The two policies have to agree (spec 153).
//
// This change made a true sentence false: the privacy policy said "We add no analytics", and the cookie
// policy explained the absence of a banner by claiming we measure nothing. Both were correct until the
// moment they were not, and neither would have failed a typecheck.
//
// So the assertions here are about *claims*, not markup: that neither page still denies the analytics,
// that the cookie policy actually describes it, and that the reason given for having no banner is the
// new one — the tool stores nothing on your device — rather than the old one.
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CookiesPage from "./cookies/page";
import PrivacyPage from "./privacy/page";

const textOf = (ui: React.ReactElement): string => {
  const { container } = render(ui);
  return container.textContent ?? "";
};

describe("the cookie policy", () => {
  it("names the analytics and says it is cookieless", () => {
    const text = textOf(<CookiesPage />);

    expect(text).toMatch(/Vercel Web Analytics/);
    expect(text).toMatch(/cookieless/i);
  });

  it("no longer claims there are no analytics cookies as the reason for having no banner", () => {
    const text = textOf(<CookiesPage />);

    // The old sentence: "There are no analytics, advertising or tracking cookies … and that is why you
    // are not asked to accept a banner." The first half stopped being the reason.
    expect(text).not.toMatch(/no\s+analytics,\s+advertising or tracking cookies/i);
  });

  it("still explains why no banner is asked for, on the new grounds", () => {
    const text = textOf(<CookiesPage />);

    expect(text).toMatch(/no banner/i);
    // The load-bearing claim: nothing is stored on the visitor's device.
    expect(text).toMatch(/stores nothing on your device|sets no cookie/i);
  });

  it("says the analytics stays off the signed-in app", () => {
    expect(textOf(<CookiesPage />)).toMatch(/public pages/i);
  });
});

describe("the privacy policy", () => {
  it("no longer claims we add no analytics", () => {
    const text = textOf(<PrivacyPage />);

    // The exact sentence this change had to correct.
    expect(text).not.toMatch(/We add no analytics/i);
  });

  it("names Vercel as the analytics processor, not only the host", () => {
    const text = textOf(<PrivacyPage />);

    expect(text).toMatch(/Vercel/);
    expect(text).toMatch(/analytics/i);
  });

  it("keeps the promises that did not change", () => {
    const text = textOf(<PrivacyPage />);

    // Losing these while rewriting the sentence next to them is the realistic mistake.
    expect(text).toMatch(/advertising/i);
    expect(text).toMatch(/session-recording/i);
    expect(text).toMatch(/intellectual property/i);
  });

  it("points at the cookie policy for the detail", () => {
    render(<PrivacyPage />);

    const links = screen.getAllByRole("link", { name: /cookie policy/i });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link).toHaveAttribute("href", "/cookies");
  });
});

describe("the two policies together", () => {
  it("do not contradict each other about whether we measure visits", () => {
    const cookies = textOf(<CookiesPage />);
    const privacy = textOf(<PrivacyPage />);

    // One saying "we measure nothing" while the other describes a visit counter is the failure this
    // whole file exists to prevent — a reader who checks both should not catch us out.
    for (const text of [cookies, privacy]) {
      expect(text).not.toMatch(/no analytics[.,]/i);
      expect(text).toMatch(/analytics/i);
    }
  });
});
