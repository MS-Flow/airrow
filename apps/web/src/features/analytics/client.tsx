"use client";

// The browser half of the funnel (spec 182), and the file where spec 153's promise is kept.
//
// **`persistence: "memory"` is the whole of this file's design.** Spec 153 shipped a cookie policy
// that tells visitors, in their own words, that measurement here writes nothing to their device and
// that *this is why* they are never asked to accept a banner. PostHog's own quickstart would break
// that in one line of configuration, silently, and the first anyone would know is a cookie appearing
// in devtools under a policy that says it cannot. So: nothing is written to `document.cookie`,
// nothing to `localStorage`, nothing to `sessionStorage`, and `client.test.ts` asserts it.
//
// What that costs is stated rather than hidden. An identity that lives in memory dies with the page,
// so a visitor who leaves and comes back is two visitors and `visit → start → signup` is a **floor**,
// not a measurement. Everything from `signup` down is server-sent against a workspace id and is
// exact. The cure for the top half is a cookie, and a cookie is a banner, and that is a trade to make
// deliberately in its own issue rather than by importing a default.
//
// **`posthog-js` is loaded dynamically, and that is not a micro-optimisation.** It is 228 kB, this
// component is mounted from the *root* layout, and the landing page is the one page the whole launch
// plan is about. A static import put all of it on the critical path of every page for every visitor,
// including the deployments that have no key and send nothing. The import now happens after the key
// check, so an unconfigured deployment downloads none of it and a configured one downloads it beside
// the page rather than in front of it.
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  isPrivatePath,
  readUtm,
  sanitize,
  type EventName,
  type EventProperties,
  type Utm
} from "./events";

/** The library's own type, taken without importing it — `import type` is erased at build. */
type PostHog = typeof import("posthog-js").default;

/**
 * The campaign this page session arrived on.
 *
 * Module state, not storage — the same decision as `persistence: "memory"`, for the same reason. It
 * survives client-side navigation within the app, which is how a visitor gets from the landing page
 * to the interview, and it does not survive a full page load, which is the honest limit of measuring
 * a campaign without keeping anything.
 */
let campaign: Utm = {};

let client: PostHog | null = null;
let loading: Promise<void> | null = null;

/**
 * Events raised before the library finished downloading.
 *
 * The queue exists because the import is now asynchronous and the first event is not: an interview
 * mounts and fires `interview_started` immediately, and on a slow connection that would land in the
 * gap and simply be lost — silently, and disproportionately for the visitors whose experience we
 * would most want to measure.
 *
 * Bounded, because an unbounded buffer on a page whose script never arrives is a memory leak with a
 * good excuse. Ten is more than any real page session raises before the import settles.
 */
const MAX_QUEUED = 10;
const queued: { name: EventName; properties: Record<string, unknown> }[] = [];

const key = (): string | null => process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() || null;

const host = (): string =>
  process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://eu.i.posthog.com";

/** Whether the browser is measuring at all — false on every deployment without a key. */
export function analyticsReady(): boolean {
  return client !== null;
}

/** The options this file exists to hold, in one place so a test can read them back. */
export const POSTHOG_OPTIONS = {
  // Nothing on the device. This is the line spec 153's cookie policy is describing.
  persistence: "memory",
  // Pageviews are sent by hand below: the App Router changes the URL without a page load, so
  // PostHog's own listener either misses navigations or double-counts them depending on the version.
  // One `pageview` per rendered path, from the router, is a thing we can reason about.
  capture_pageview: false,
  capture_pageleave: false,
  // Session recording would reach interview answers, which are customer IP (§II). Never on.
  disable_session_recording: true,
  autocapture: false
} as const;

/**
 * Download and start PostHog, once.
 *
 * Resolves to `false` — without downloading anything — when there is no key, which is the ordinary
 * state of a developer machine, a preview and a fork.
 */
export async function initAnalytics(search: string): Promise<boolean> {
  if (client) return true;
  const projectKey = key();
  if (!projectKey) return false;

  campaign = readUtm(search);
  loading ??= (async () => {
    try {
      const { default: posthog } = await import("posthog-js");
      posthog.init(projectKey, { api_host: host(), ...POSTHOG_OPTIONS });
      client = posthog;
      for (const event of queued.splice(0)) {
        client.capture(event.name, event.properties);
      }
    } catch {
      // A blocked or failed chunk means no analytics, never a broken page. The queue is dropped so
      // it cannot grow behind a script that is never coming.
      queued.length = 0;
    }
  })();

  await loading;
  return client !== null;
}

/**
 * Send one event from the browser, and never let it matter.
 *
 * Silent when there is no key. Queued — not dropped — while the library is still downloading.
 */
export function captureClient<N extends EventName>(name: N, properties: EventProperties[N]): void {
  if (!key()) return;
  const sanitized = sanitize(name, properties, campaign);
  try {
    if (client) {
      client.capture(name, sanitized);
      return;
    }
    if (queued.length < MAX_QUEUED) queued.push({ name, properties: sanitized });
  } catch {
    // An event is never worth an error boundary. There is nothing a visitor could do about it and
    // nothing about the page that depends on it.
  }
}

/**
 * Mounted once from the root layout, beside the Vercel Analytics that spec 153 put there.
 *
 * Both stay. Vercel answers "how many people reached the site" for free and without a key; this
 * answers "and then what did they do", which is the question a launch is judged on. Overlapping on
 * page views for a while is cheaper than a migration on the critical path.
 */
export function FunnelAnalytics(): null {
  const pathname = usePathname();

  useEffect(() => {
    // A workspace path is nobody's business to record, and it carries a project id in it. The funnel
    // inside `/app` is measured by named events with deliberate properties instead — the same
    // decision spec 153 made for the same reason, asked of the same predicate.
    if (isPrivatePath(pathname)) return;
    // `window.location.search` rather than `useSearchParams`: that hook opts the whole tree into
    // client-side rendering at the root, which would cost every public page its static shell for a
    // value this reads exactly once.
    void initAnalytics(window.location.search).then((started) => {
      if (started) captureClient("pageview", { path: pathname });
    });
  }, [pathname]);

  return null;
}

/** Forget everything this module holds. Tests only. */
export function resetClientAnalyticsForTests(): void {
  client = null;
  loading = null;
  campaign = {};
  queued.length = 0;
}
