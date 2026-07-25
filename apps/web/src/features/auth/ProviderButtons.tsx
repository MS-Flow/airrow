import { Github, Mail, Sparkles, Wand2 } from "lucide-react";

/**
 * Google / GitHub / Email / Magic link, designed but inert (spec 19). #18 shipped
 * email + password only, so these are rendered `disabled` rather than wired to a
 * flow that would fail — a button that looks enabled and does nothing is worse
 * than an honest one that says it isn't ready.
 */
const PROVIDERS = [
  { id: "google", label: "Continue with Google", icon: Sparkles },
  { id: "github", label: "Continue with GitHub", icon: Github },
  { id: "email", label: "Continue with Email", icon: Mail },
  { id: "magic", label: "Send a magic link", icon: Wand2 }
] as const;

export function ProviderButtons() {
  return (
    <div className="space-y-2">
      {PROVIDERS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          disabled
          aria-disabled="true"
          title="Coming soon"
          className="flex h-10 w-full cursor-not-allowed items-center justify-center gap-2.5 rounded-md border border-border bg-surface text-base font-medium text-fg-faint opacity-70"
        >
          <Icon className="size-4" />
          {label}
          <span className="rounded-full border border-border bg-bg-subtle px-1.5 py-0.5 text-2xs uppercase tracking-wide">
            Soon
          </span>
        </button>
      ))}
    </div>
  );
}
