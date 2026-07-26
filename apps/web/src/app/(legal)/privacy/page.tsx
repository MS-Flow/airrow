import Link from "next/link";
import { LEGAL } from "@/features/legal/meta";

export const metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy policy</h1>
      <p>
        This page explains what {LEGAL.serviceName} stores when you use {LEGAL.domain}, why it is
        stored, and who else can see it. It describes the product as it is built, not as a
        generic template.
      </p>

      <h2>What we store</h2>
      <ul>
        <li>
          <strong>Account data.</strong> Your email address, your display name, and the
          authentication record held by our auth provider. Passwords are never stored in
          readable form.
        </li>
        <li>
          <strong>Project data.</strong> Your interview answers, the project model derived from
          them, and the documents generated for you. This is your intellectual property and we
          treat it that way.
        </li>
        <li>
          <strong>Operational logs.</strong> Request metadata, identifiers, timestamps and
          errors. Logs deliberately carry IDs and metadata only, never your answers or the
          contents of generated documents.
        </li>
      </ul>

      <h2>Why we store it</h2>
      <p>
        To run the service you asked for: authenticate you, keep your projects separate from
        everyone else&apos;s, generate your foundation, and let you download it again later. We
        also keep the minimum needed to secure accounts and diagnose failures. We do not sell
        your data, and we do not use it for advertising.
      </p>

      <h2>Who processes it</h2>
      <ul>
        <li>
          <strong>Vercel</strong> hosts the application and serves it over its network.
        </li>
        <li>
          <strong>Supabase</strong> provides the database, authentication and file storage where
          your projects live.
        </li>
        <li>
          <strong>Anthropic</strong> receives the parts of your project model needed to author
          your documents, and processes them under its API terms to return the generated text.
        </li>
      </ul>
      <p>
        These are processors acting on our instructions. We add no analytics, advertising or
        session-recording services.
      </p>

      <h2>How it is protected</h2>
      <p>
        Every resource belongs to an organization, and access is enforced in the database itself
        through row-level security as well as in the application. Data is encrypted at rest,
        downloads are served through short-lived signed links, and repository access, where you
        connect it, uses scoped app installations rather than personal access tokens.
      </p>

      <h2>How long it is kept</h2>
      <p>
        Project data is kept until you delete it. Deleting a project cascades to its interview,
        project model, generation jobs, artifacts and stored files. Deleting your account removes
        your organization and everything hanging off it. Backups and logs age out on their own
        retention schedule shortly afterwards.
      </p>

      <h2>Your rights</h2>
      <p>
        If you are in the EU or UK you can ask for a copy of your data, correct it, have it
        erased, restrict or object to processing, and complain to your national supervisory
        authority. You can delete projects and your account yourself at any time. For anything
        else, write to <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
      </p>

      <h2>Cookies</h2>
      <p>
        {LEGAL.serviceName} sets only the cookies it needs to work. They are listed in the{" "}
        <Link href="/cookies">cookie policy</Link>.
      </p>

      <h2>Changes</h2>
      <p>
        When this policy changes, the date at the top of the page changes with it. Material
        changes are announced in the application before they take effect.
      </p>
    </>
  );
}
