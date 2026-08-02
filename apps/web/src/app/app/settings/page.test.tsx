// The GitHub section of Settings has to answer the question the founder actually asked: is *my*
// GitHub account connected? It used to answer a different one — whether a GitHub App was configured
// on the server — which told someone who had just signed in with GitHub that they were not connected.
//
// The session, allowance and theme are mocked: all three read cookies or the database, neither of
// which exists outside a request.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const identity = vi.hoisted((): { current: { login: string | null; connectedAt: string | null } | null } => ({
  current: null
}));

const plan = vi.hoisted((): { current: "free" | "pro" } => ({ current: "free" }));

/** Set when the workspace is unlimited on a week it earned rather than on a subscription (spec 122). */
const onEarnedWeek = vi.hoisted((): { current: boolean } => ({ current: false }));

vi.mock("@/lib/auth", () => ({
  requireSession: async () => ({
    user: { id: "u1", name: "Ada", email: "ada@example.com", createdAt: "2026-01-01" },
    org: { id: "o1", name: "Ada's workspace", kind: "personal", plan: plan.current }
  }),
  githubIdentity: async () => identity.current,
  updateName: vi.fn(),
  // Which shape the credential cards take (spec 171): an account with a password is the ordinary case,
  // and `Settings — credentials` below flips it.
  hasPassword: async () => accountHasPassword.current
}));
const accountHasPassword = vi.hoisted((): { current: boolean } => ({ current: true }));
vi.mock("@/features/auth/credentials", () => ({
  changePasswordAction: vi.fn(),
  changeEmailAction: vi.fn(),
  sendPasswordSetupAction: vi.fn()
}));
vi.mock("@/features/auth/PasswordFields", () => ({ PasswordFields: () => null }));
const customer = vi.hoisted((): { current: unknown } => ({ current: null }));
vi.mock("@/features/billing/sync", () => ({
  // When to re-ask Stripe is `sync.test.ts`'s subject. Here the page is what is under test, so it is
  // simply handed the plan and the subscription that reconciliation would have produced.
  planWithStripe: async (org: { plan: string }) => ({ plan: org.plan, subscription: customer.current })
}));
vi.mock("@/lib/stripe", () => ({
  stripeConfigured: () => true,
  stripePrices: () => [{ id: "price_monthly", interval: "month" }]
}));
vi.mock("@/lib/theme", () => ({ readTheme: async () => "dark" }));
vi.mock("@/features/generation/allowance", () => ({
  FREE_GENERATION_LIMIT: 1,
  FREE_REPAIR_LIMIT: 2,
  REPAIR_WINDOW_HOURS: 24,
  // Follows the plan, the way the real one does: Pro is what makes the card render its billing half.
  // An earned week is the third case — unlimited, on a free plan, with a reason of its own.
  checkAllowance: async () => {
    if (onEarnedWeek.current) {
      return { allowed: true, plan: "free", grant: "referral", unlimited: true, used: 1, remaining: Infinity };
    }
    return plan.current === "pro"
      ? { allowed: true, plan: "pro", grant: "pro", unlimited: true, used: 3, remaining: Infinity }
      : { allowed: true, plan: "free", grant: "free", unlimited: false, used: 0, remaining: 1 };
  }
}));
vi.mock("@/features/auth/actions", () => ({ signInWithGitHubAction: vi.fn() }));

// The invite card reads the database and builds its link from the request's own host — neither exists
// here. The constants come with the mock because the card renders them (spec 122).
interface InviteRow {
  attachedAt: string;
  name: string;
  state: "joined" | "generated";
  uncredited: boolean;
}
const referral = vi.hoisted(
  (): {
    current: {
      activeUntil: string | null;
      queued: number;
      remaining: number;
      invites?: InviteRow[];
    };
  } => ({ current: { activeUntil: null, queued: 0, remaining: 3 } })
);
/** Null is what a database behind the referrals migration produces (spec 122). */
const referralsInstalled = vi.hoisted((): { current: boolean } => ({ current: true }));
vi.mock("@/lib/data/referrals", () => ({
  REFERRAL_CAP: 3,
  REFERRAL_GRANT_DAYS: 7,
  UNNAMED_INVITE: "Someone",
  referralSummary: async () =>
    referralsInstalled.current
      ? { code: "invite-code", invites: [], credited: 0, ...referral.current }
      : null
}));
vi.mock("@/lib/site-url", () => ({ requestOrigin: async () => "https://airrow.test" }));

import SettingsPage from "./page";

const settings = (
  searchParams: { saved?: string; upgraded?: string; error?: string; status?: string } = {}
) => SettingsPage({ searchParams: Promise.resolve(searchParams) });

// A founder came back from Checkout, money had left their account, and Settings said "You're on Pro"
// directly above "Free · 0 of 1 foundation left". Both sentences came from the same page and only one
// of them was checked against the database — the other was inferred from a query string, which is the
// exact thing spec 99 says proves nothing.
describe("Settings — coming back from Checkout", () => {
  it("does not claim Pro while the plan still says free", async () => {
    plan.current = "free";
    render(await settings({ upgraded: "1" }));

    expect(screen.queryByText(/you.re on pro/i)).not.toBeInTheDocument();
    expect(screen.getByText(/stripe has no paid subscription/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing is lost/i)).toBeInTheDocument();
  });

  it("confirms it once the plan actually says so", async () => {
    plan.current = "pro";
    render(await settings({ upgraded: "1" }));

    expect(screen.getByText(/payment confirmed/i)).toBeInTheDocument();
  });

  it("says nothing about a payment when nobody came back from Checkout", async () => {
    plan.current = "free";
    render(await settings());

    expect(screen.queryByText(/stripe has no paid subscription/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/payment confirmed/i)).not.toBeInTheDocument();
  });

  it("offers a re-check to someone who has been to Checkout and is still on free", async () => {
    // The way out of "I paid and it says free" without a support ticket: ask Stripe again.
    plan.current = "free";
    customer.current = { organizationId: "o1", customerId: "cus_1", status: "incomplete" };
    render(await settings());

    expect(screen.getByRole("button", { name: /already paid\? check again/i })).toBeEnabled();
  });

  it("tells a Pro founder who cancelled that it is ending, not that it renews", async () => {
    plan.current = "pro";
    customer.current = {
      organizationId: "o1",
      customerId: "cus_1",
      subscriptionId: "sub_1",
      status: "active",
      currentPeriodEnd: "2026-08-30T09:00:00.000Z",
      cancelAtPeriodEnd: true
    };
    render(await settings({}));

    expect(screen.getByText("Cancelled")).toBeInTheDocument();
    expect(screen.getByText(/runs until 2026-08-30 and does not renew/i)).toBeInTheDocument();
    expect(screen.queryByText(/renews automatically/i)).not.toBeInTheDocument();
    // And a way to make the page agree with Stripe without waiting for a webhook.
    expect(screen.getByRole("button", { name: /check again/i })).toBeEnabled();
  });

  it("does not offer it to someone who has never started a payment", async () => {
    // Nothing to re-check, and asking would read as the product doubting whether they paid.
    plan.current = "free";
    customer.current = null;
    render(await settings());

    expect(screen.queryByRole("button", { name: /check again/i })).not.toBeInTheDocument();
  });
});

/* ── The invite card, and the week it can produce (spec 122) ────────────────
 *
 * A week earned by inviting somebody makes the workspace unlimited, which is exactly the state the
 * billing half of this card was written for — so the danger is that it renders as a subscription.
 * There is no card behind it and nothing renews, and a founder told otherwise has been lied to about
 * money.
 */
describe("Settings — invitations", () => {
  it("offers the link and says how many places are left", async () => {
    plan.current = "free";
    onEarnedWeek.current = false;
    referral.current = { activeUntil: null, queued: 0, remaining: 3 };
    render(await settings());

    expect(screen.getByText(/invite a friend/i)).toBeInTheDocument();
    expect(screen.getByText(/3 of 3 left/i)).toBeInTheDocument();
    expect(screen.getByText("https://airrow.test/invite/invite-code")).toBeInTheDocument();
  });

  it("stops offering the link once every place is used", async () => {
    plan.current = "free";
    referral.current = { activeUntil: null, queued: 0, remaining: 0 };
    render(await settings());

    expect(screen.queryByText("https://airrow.test/invite/invite-code")).not.toBeInTheDocument();
    expect(screen.getByText(/used all 3 places/i)).toBeInTheDocument();
  });

  it("never presents an earned week as a subscription", async () => {
    plan.current = "free";
    onEarnedWeek.current = true;
    customer.current = null;
    referral.current = { activeUntil: "2026-08-08T09:00:00.000Z", queued: 0, remaining: 2 };
    render(await settings());

    expect(screen.getByText(/not a subscription/i)).toBeInTheDocument();
    expect(screen.getByText(/runs until 2026-08-08/i)).toBeInTheDocument();
    expect(screen.queryByText(/renews automatically/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /manage billing/i })).not.toBeInTheDocument();
  });

  it("still renders the page when the database has never heard of referrals", async () => {
    // The regression: a dev server pointed at a project without the migration answered "Could not
    // find the table 'public.plan_grants' in the schema cache" and Settings died on it. An absent
    // card is a missing aside; an unloadable Settings page is somebody unable to manage their billing.
    plan.current = "free";
    onEarnedWeek.current = false;
    referralsInstalled.current = false;
    render(await settings());

    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^plan$/i })).toBeInTheDocument();
    expect(screen.queryByText(/invite a friend/i)).not.toBeInTheDocument();

    referralsInstalled.current = true;
  });

  it("names the founder each invitation is about", async () => {
    // Three rows reading "Generated their foundation" tell the person who sent the links nothing
    // about which of their invitations paid out (spec 133).
    plan.current = "free";
    onEarnedWeek.current = false;
    referralsInstalled.current = true;
    referral.current = {
      activeUntil: null,
      queued: 1,
      remaining: 2,
      invites: [
        { attachedAt: "2026-07-31T00:00:00.000Z", name: "Ada Lovelace", state: "generated", uncredited: false },
        { attachedAt: "2026-07-31T00:00:00.000Z", name: "Grace Hopper", state: "joined", uncredited: false }
      ]
    };
    render(await settings());

    expect(screen.getByText(/Ada Lovelace generated their foundation/i)).toBeInTheDocument();
    expect(screen.getByText(/Grace Hopper signed up/i)).toBeInTheDocument();

    referral.current = { activeUntil: null, queued: 0, remaining: 3 };
  });

  it("says a waiting week is not counting down yet", async () => {
    plan.current = "free";
    onEarnedWeek.current = false;
    referral.current = { activeUntil: null, queued: 2, remaining: 1 };
    render(await settings());

    expect(screen.getByText(/2 weeks are waiting/i)).toBeInTheDocument();
  });
});

describe("Settings — GitHub account", () => {
  it("names the connected account instead of claiming nothing is connected", async () => {
    identity.current = { login: "adalovelace", connectedAt: "2026-07-29T00:00:00Z" };
    render(await settings());

    expect(screen.getByText("@adalovelace")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /import a repository/i })).toHaveAttribute(
      "href",
      "/app/projects/import"
    );
    expect(screen.queryByRole("button", { name: /sign in with github/i })).not.toBeInTheDocument();
  });

  it("offers the sign-in when no GitHub account is connected", async () => {
    identity.current = null;
    render(await settings());

    expect(screen.getByRole("button", { name: /sign in with github/i })).toBeEnabled();
  });

  it("keeps the App — which writes — apart from the sign-in, which cannot", async () => {
    identity.current = { login: "adalovelace", connectedAt: null };
    render(await settings());

    // Both cards exist, and only the App's Connect button is inert: the account is already connected
    // and the App is not built. One badge must never stand for the other.
    expect(screen.getByText(/GitHub App — repository delivery/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect" })).toBeDisabled();
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("Not set up")).toBeInTheDocument();
  });
});

// The credentials a founder signs in with (spec 171). Before this they were one disabled input under
// "managed by your account sign-in", which was true of nothing except our own missing screen.
describe("Settings — credentials", () => {
  it("offers to change the password, asking for the current one", async () => {
    accountHasPassword.current = true;
    render(await settings());

    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /change password/i })).toBeInTheDocument();
  });

  it("offers to change the login address, and says the change waits for the new inbox", async () => {
    accountHasPassword.current = true;
    render(await settings());

    expect(screen.getByLabelText(/new email/i)).toBeInTheDocument();
    expect(screen.getByText(/your login stays/i)).toBeInTheDocument();
    // Its own wording, so nobody navigating by label has to guess which of the two password boxes on
    // this page they have landed in.
    expect(screen.getByLabelText(/confirm with your password/i)).toBeInTheDocument();
  });

  // A GitHub- or Google-only account has no password, so a "current password" field would be asking for
  // something that does not exist.
  it("offers a provider-only account a link to set a password instead of a field it cannot fill", async () => {
    accountHasPassword.current = false;
    render(await settings());

    expect(screen.queryByLabelText(/current password/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /email me a link to set one/i })).toBeInTheDocument();
    expect(screen.getByText(/set a password first/i)).toBeInTheDocument();
  });

  /*
   * Both cards read the same query string, so an answer meant for one of them used to render under the
   * other as well — "open the link we sent to the new address" appeared above the password form, which is
   * two instructions for one action. Each card now renders only the keys its own action redirects with.
   */
  it("reports an email change under the email card, and nowhere else", async () => {
    accountHasPassword.current = true;
    render(await settings({ status: "email-sent" }));

    expect(screen.getByText(/open the link we sent to the new address/i)).toBeInTheDocument();
  });

  it("names the reason a change was refused, once", async () => {
    accountHasPassword.current = true;
    render(await settings({ error: "wrong-password" }));

    const alerts = screen.getAllByRole("alert");
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.textContent).toMatch(/not your current password/i);
  });
});
