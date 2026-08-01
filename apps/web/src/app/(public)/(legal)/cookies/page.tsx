import Link from "next/link";
import { LEGAL } from "@/features/legal/meta";

export const metadata = { title: "Cookie policy" };

export default function CookiesPage() {
  return (
    <>
      <h1>Cookie policy</h1>
      <p>
        {LEGAL.serviceName} uses only the cookies the service needs to function. There are no
        analytics, advertising or tracking cookies, nothing is shared with third parties for
        profiling, and that is why you are not asked to accept a banner: strictly necessary
        cookies do not require consent.
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
