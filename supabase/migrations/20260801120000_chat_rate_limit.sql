-- What the landing chat is allowed to spend (spec 141).
--
-- Two ceilings, one table: a global one that is the cost limit, and a per-visitor one that stops a
-- single abuser eating it before a real founder arrives. Both are counted per UTC day.
--
-- This table is the one resource in the schema that is **not** keyed by organization_id, and the
-- deviation from §II is deliberate and recorded in spec 141: the chat answers anonymous visitors on a
-- public page, and there is no organization to hang a counter off. What replaces tenancy here is that
-- nobody may read it at all — `authenticated` is granted nothing, and the denial test says so.
--
-- Idempotent, replays cleanly from zero.

/* ── The counters ───────────────────────────────────────────────────────────
 *
 * `bucket` is either the reserved value 'global' or a visitor's hashed key. One table rather than
 * two because the two ceilings are checked together on every answer, and a second table would double
 * the round trips for a row that has exactly the same shape.
 *
 * The visitor key is a salted hash of the request's IP, computed in the app. It is stored rather than
 * the address itself and it cannot be reversed without the salt, which is a server secret: this table
 * therefore holds no personal data and, deliberately, not one character the visitor typed.
 */
create table if not exists public.chat_rate_limits (
  bucket  text not null,
  day     date not null,
  answers integer not null default 0,
  primary key (bucket, day)
);

comment on table public.chat_rate_limits is
  'Daily answer counters for the landing chat (spec 141). Not org-scoped: visitors are anonymous. Holds no message content and no reversible identifier.';

/* ── Claiming one answer ────────────────────────────────────────────────────
 *
 * One call, one transaction, both ceilings. Doing this in the app as read-then-write would race with
 * itself under any concurrency at all, and the thing being protected is a budget — a limit that is
 * only approximately enforced is a limit that can be exceeded on purpose.
 *
 * The visitor's counter is claimed first and *given back* if the global ceiling then refuses, so a
 * visitor is never charged for an answer the day could not afford. The reverse order would silently
 * spend someone's personal allowance on a request nobody was served.
 *
 * The day is UTC rather than the server's local date, so the same input produces the same result
 * wherever this runs (§V).
 */
create or replace function public.claim_chat_answer(
  p_visitor       text,
  p_visitor_limit integer,
  p_global_limit  integer
) returns text
language plpgsql
as $$
declare
  v_day     date := (now() at time zone 'utc')::date;
  v_visitor integer;
  v_global  integer;
begin
  if p_visitor is null or p_visitor = 'global' then
    raise exception 'claim_chat_answer: a visitor bucket is required and may not be the reserved name';
  end if;

  -- `where` on the conflict update is the ceiling: when it fails there is no returned row, which is
  -- how a full bucket is reported without a separate read.
  insert into public.chat_rate_limits as c (bucket, day, answers)
  values (p_visitor, v_day, 1)
  on conflict (bucket, day) do update set answers = c.answers + 1
    where c.answers < p_visitor_limit
  returning c.answers into v_visitor;

  if v_visitor is null then
    return 'visitor';
  end if;

  insert into public.chat_rate_limits as c (bucket, day, answers)
  values ('global', v_day, 1)
  on conflict (bucket, day) do update set answers = c.answers + 1
    where c.answers < p_global_limit
  returning c.answers into v_global;

  if v_global is null then
    update public.chat_rate_limits
      set answers = answers - 1
      where bucket = p_visitor and day = v_day;
    return 'global';
  end if;

  return 'ok';
end;
$$;

comment on function public.claim_chat_answer(text, integer, integer) is
  'Claims one landing-chat answer against the per-visitor and global daily ceilings (spec 141). Returns ok | visitor | global.';

/* ── Giving one back ────────────────────────────────────────────────────────
 *
 * A claim is made *before* the model is called, because making the call is what costs money. When the
 * call then fails — no network, a rate limit upstream, nothing usable in the response — the visitor
 * has paid for an answer they never received, and five such failures would lock them out for the day
 * having been told nothing. So a claim that produced no answer is released.
 *
 * Never below zero: a release that arrives twice, or after the day has rolled over, must not hand out
 * free allowance.
 */
create or replace function public.release_chat_answer(p_visitor text)
returns void
language sql
as $$
  update public.chat_rate_limits
    set answers = answers - 1
    where bucket in (p_visitor, 'global')
      and day = (now() at time zone 'utc')::date
      and answers > 0;
$$;

comment on function public.release_chat_answer(text) is
  'Returns one claimed landing-chat answer to both ceilings when the model produced nothing (spec 141).';

/* ── Access ─────────────────────────────────────────────────────────────────
 *
 * Stricter than any other table in the schema: `service_role` and nothing else. There is no policy
 * for `authenticated` because there is no query it should ever be allowed to run — this table is not
 * about the signed-in founder, and a counter a browser can read is a counter it can be shown to have
 * room in. RLS is enabled with no policies at all, so even a mistaken future grant reaches nothing.
 *
 * The function is revoked the same way. It writes, so `execute` on it is the same privilege as
 * `insert` on the table, and leaving it with the default public grant would let any browser session
 * burn the day's budget one call at a time.
 */
alter table public.chat_rate_limits enable row level security;

grant all on public.chat_rate_limits to service_role;
revoke all on public.chat_rate_limits from anon, authenticated;

revoke all on function public.claim_chat_answer(text, integer, integer) from public;
grant execute on function public.claim_chat_answer(text, integer, integer) to service_role;

revoke all on function public.release_chat_answer(text) from public;
grant execute on function public.release_chat_answer(text) to service_role;
