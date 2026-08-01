import Link from "next/link";
import { LEGAL } from "@/features/legal/meta";

export const metadata = { title: "Cookie policy" };

export default function CookiesPage() {
  return (
    <>
      <h1>Cookie policy</h1>
      <p>
        {LEGAL.serviceName} uses only the cookies the service needs to function. There are no
        advertising or tracking cookies, and nothing is shared with third parties for profiling.
      </p>
      <p>
        We do measure how many people visit the site, and we do it without cookies — see{" "}
        <a href="#analytics">how we count visits</a> below. That is why there is still no banner
        asking you to accept anything: strictly necessary cookies do not require consent, and
        measurement that stores nothing on your device does not either.
      </p>

      <h2>What is set</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Purpose</th>
            <th>Lifetime</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>airrow-theme</code>
            </td>
            <td>
              Remembers whether you chose the dark or light theme, so the first paint is already
              correct. Holds one of two values and nothing else.
            </td>
            <td>One year</td>
          </tr>
          <tr>
            <td>
              <code>sb-*</code>
            </td>
            <td>
              Authentication cookies set by our auth provider, Supabase. They keep you signed in
              and let the session refresh. Without them you cannot use an account.
            </td>
            <td>Session, refreshed while you stay signed in</td>
          </tr>
        </tbody>
      </table>

      <h2 id="analytics">How we count visits</h2>
      <p>
        We use <strong>Vercel Web Analytics</strong>, which is cookieless. It sets no cookie, writes
        nothing to your browser&apos;s storage, and reads nothing that is already there. It records
        that a page was viewed — the page, the referring site, and coarse details like country,
        browser and device type — and aggregates it. It does not build a profile of you, does not
        follow you to other sites, and is never joined to an account, a workspace or a project.
      </p>
      <p>
        This is why you are not asked to consent to it. The rule that makes consent banners necessary
        is about storing or reading information on your device; measurement that does neither does not
        trigger it. We rely on our legitimate interest in knowing whether people can find the service
        at all, and we have chosen a tool that buys that answer at the lowest cost to you.
      </p>
      <p>
        It runs only on the public pages. Nothing you do while signed in to your workspace is
        measured this way.
      </p>
      <p>
        If you would rather not be counted at all, any content blocker will stop the script, and the
        site works exactly the same without it.
      </p>

      <h2>Browser storage</h2>
      <p>
        If you start the interview before creating an account, your draft answers are held in
        your browser&apos;s local storage under <code>airrow-guest-interview</code> until you sign
        in and claim them. Nothing is written to our servers before that. Clearing your browser
        data removes the draft.
      </p>

      <h2>Controlling cookies</h2>
      <p>
        Your browser can block or delete cookies for this site. Blocking the theme cookie only
        means the site forgets your theme. Blocking the authentication cookies means you cannot
        stay signed in, so the signed-out interview is all that remains usable.
      </p>

      <h2>More</h2>
      <p>
        What we store beyond cookies, and who processes it, is in the{" "}
        <Link href="/privacy">privacy policy</Link>. Questions go to{" "}
        <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
      </p>
    </>
  );
}
