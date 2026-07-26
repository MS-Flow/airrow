import Link from "next/link";
import { LEGAL } from "@/features/legal/meta";

export const metadata = { title: "Terms of service" };

export default function TermsPage() {
  return (
    <>
      <h1>Terms of service</h1>
      <p>
        These terms apply when you use {LEGAL.serviceName} at {LEGAL.domain}. Using the service
        means you accept them.
      </p>

      <h2>What the service does</h2>
      <p>
        {LEGAL.serviceName} interviews you about your product and generates an engineering
        foundation for it: architecture, specifications, standards, a roadmap, a prompt library
        and AI context files. It prepares the work before coding starts. It does not write your
        application, and it is not a hosting or deployment provider.
      </p>

      <h2>Early access</h2>
      <p>
        The service is free and under active development. Features can change or be removed,
        generation can fail, and interruptions are possible. It is provided as it is, without
        warranty of availability, accuracy or fitness for a particular purpose.
      </p>

      <h2>Your account</h2>
      <p>
        Keep your credentials to yourself and your email address current. You are responsible for
        what happens under your account. Tell us at{" "}
        <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a> if you believe it has
        been used without your permission.
      </p>

      <h2>Your content and your output</h2>
      <p>
        What you put in stays yours. The documents generated for you are yours to use, change,
        publish and commercialise, with no attribution required. We take only the limited licence
        needed to operate the service on your behalf: storing your answers, generating and
        delivering your files. Nothing you write is used to train models by us.
      </p>

      <h2>Review before you rely on it</h2>
      <p>
        Generated documents are written by a language model from your answers. They are a
        starting point authored for your project, not legal, security or financial advice, and
        they can be wrong. Review them before you build on them. Decisions you make from them are
        yours.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Do not use the service for unlawful purposes or to generate unlawful material.</li>
        <li>
          Do not attempt to reach another organization&apos;s data, probe the service for
          vulnerabilities without permission, or work around its access controls.
        </li>
        <li>
          Do not automate abusive volumes of generation, resell the service as your own, or
          disrupt it for others.
        </li>
      </ul>

      <h2>Suspension and termination</h2>
      <p>
        You can stop at any time by deleting your projects and your account. We can suspend or
        close an account that breaks these terms or puts the service or other users at risk,
        normally with notice, and immediately where the risk is serious.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent the law allows, {LEGAL.serviceName} is not liable for indirect or
        consequential loss, lost profits, or lost or corrupted data arising from your use of a
        free early-access service. Nothing here limits liability that cannot be limited by law.
      </p>

      <h2>Privacy</h2>
      <p>
        What we store and who processes it is set out in the{" "}
        <Link href="/privacy">privacy policy</Link>, which forms part of these terms.
      </p>

      <h2>Changes</h2>
      <p>
        When these terms change, the date at the top of the page changes with them. Continuing to
        use the service after a material change means you accept the new version.
      </p>
    </>
  );
}
