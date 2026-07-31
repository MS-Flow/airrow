import { Github } from "lucide-react";
import { GoogleMark } from "@/components/brand/google-mark";
import { signInWithGitHubAction, signInWithGoogleAction } from "./actions";

/**
 * The two ways into Airrow that are not an email address (specs 67, 140).
 *
 * GitHub asks for no scopes at all; Google asks for an identity and nothing more. Both sign the founder
 * in and neither reaches a repository — private content and every write go through an App installation
 * instead (§II).
 *
 * Spec 19 designed three more buttons — Google, "Continue with Email" and "Send a magic link" — and
 * rendered them `disabled` behind a "Soon" badge. Google is now real. The other two were removed rather
 * than left waiting: we never intended to build them, and a badge promising something that is not coming
 * is a slower way of saying the same untrue thing.
 */

const PROVIDERS = [
  { id: "github", label: "Continue with GitHub", action: signInWithGitHubAction, Mark: Github },
  { id: "google", label: "Continue with Google", action: signInWithGoogleAction, Mark: GoogleMark }
] as const;

const BUTTON =
  "flex h-10 w-full cursor-pointer items-center justify-center gap-2.5 rounded-md border border-border bg-surface text-base font-medium text-fg transition-colors duration-150 hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function ProviderButtons() {
  return (
    <div className="space-y-2">
      {PROVIDERS.map(({ id, label, action, Mark }) => (
        <form key={id} action={action}>
          <button type="submit" className={BUTTON}>
            <Mark className="size-4" />
            {label}
          </button>
        </form>
      ))}
    </div>
  );
}
