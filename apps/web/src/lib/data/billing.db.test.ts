// The database guarantees `claimStripeEvent` leans on (spec 99).
//
// The unit tests mock the claim and assert the webhook honours its answer. What they cannot show is
// that the answer is trustworthy under concurrency — and it has to be, because Stripe redelivers and
// two retries can land at once. That property is the primary key's, not our code's, which is
// precisely why it belongs in a test against real Postgres.
//
// Runs against local Supabase (`supabase start`); skipped when the DB is unreachable.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";

const DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

// Own 'e…' namespace, so a parallel run cannot collide with the other suites.
const ORG = "00000000-0000-0000-0000-0000000000e1";
const USER = "00000000-0000-0000-0000-0000000000e2";

async function reachable(): Promise<boolean> {
  const probe = new Client({ connectionString: DB_URL, connectionTimeoutMillis: 1500 });
  try {
    await probe.connect();
    await probe.end();
    return true;
  } catch {
    return false;
  }
}

const dbUp = await reachable();

describe.skipIf(!dbUp)("stripe billing state (local Supabase)", () => {
  const db = new Client({ connectionString: DB_URL });

  beforeAll(async () => {
    await db.connect();
  });

  afterAll(async () => {
    await cleanup();
    await db.end();
  });

  beforeEach(async () => {
    await cleanup();
    await db.query("insert into public.organizations (id, name) values ($1, 'Billing Org')", [ORG]);
    await db.query(
      "insert into public.organization_members (organization_id, user_id) values ($1,$2)",
      [ORG, USER]
    );
  });

  async function cleanup(): Promise<void> {
    await db.query("delete from public.organizations where id = $1", [ORG]);
    await db.query("delete from public.stripe_events where event_id like 'evt_billing%'");
  }

  it("accepts an event id once and rejects the redelivery", async () => {
    // This is the whole of the idempotency guarantee: claiming is an insert that either wins or
    // violates the key, with no read-then-write window for a concurrent retry to slip through.
    await db.query(
      "insert into public.stripe_events (event_id, event_type) values ('evt_billing_1','checkout.session.completed')"
    );

    await expect(
      db.query(
        "insert into public.stripe_events (event_id, event_type) values ('evt_billing_1','checkout.session.completed')"
      )
    ).rejects.toThrow(/duplicate key/i);
  });

  it("holds one subscription per organization", async () => {
    // Two live subscriptions for one workspace is a billing incident, not a state to model — so the
    // schema refuses it rather than leaving the webhook to notice.
    await db.query(
      "insert into public.subscriptions (organization_id, provider_customer_id, status) values ($1,'cus_x','active')",
      [ORG]
    );

    await expect(
      db.query(
        "insert into public.subscriptions (organization_id, provider_customer_id, status) values ($1,'cus_y','active')",
        [ORG]
      )
    ).rejects.toThrow(/duplicate key/i);
  });

  it("starts an organization on free, whatever billing does later", async () => {
    const res = await db.query<{ plan: string }>(
      "select plan from public.organizations where id = $1",
      [ORG]
    );
    expect(res.rows[0]?.plan).toBe("free");
  });

  it("lets go of the subscription when the organization does", async () => {
    // Unlike the usage ledger, which outlives its project deliberately, billing state for a deleted
    // workspace is nothing anyone should keep.
    await db.query(
      "insert into public.subscriptions (organization_id, provider_customer_id, status) values ($1,'cus_x','active')",
      [ORG]
    );

    await db.query("delete from public.organizations where id = $1", [ORG]);

    const res = await db.query("select 1 from public.subscriptions where organization_id = $1", [ORG]);
    expect(res.rowCount).toBe(0);
  });
});
