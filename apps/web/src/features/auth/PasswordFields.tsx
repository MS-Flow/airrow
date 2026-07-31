"use client";

// The signup password fields (spec 140): requirements shown before a character is typed, a strength bar
// that judges rather than counts, a reveal toggle, and a repeat field.
//
// One component because they are one decision — the checklist explains the bar, the bar explains the
// refusal, and the repeat field catches the typo in a credential nobody can re-read. Signup only: a
// strength meter on /login tells an attacker something and the returning founder nothing.
import { useEffect, useRef, useState } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import { PASSWORD_RULES, unmetPasswordRules } from "@airrow/schemas";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

/**
 * zxcvbn's own 0–4 scale. 2 is "protects against unthrottled online attack" — the floor we hold, on top
 * of the four character classes the schema requires separately.
 *
 * Not 3: with the classes already mandatory, demanding "safely unguessable" as well rejects passwords a
 * founder chose deliberately, and a form that refuses a good answer teaches people to write worse ones
 * down.
 */
const MIN_SCORE = 2;

const STRENGTH = [
  { label: "Weak", indicator: "bg-danger" },
  { label: "Weak", indicator: "bg-danger" },
  { label: "Fair", indicator: "bg-warn" },
  { label: "Good", indicator: "bg-accent" },
  { label: "Strong", indicator: "bg-success" }
] as const;

type Scorer = (password: string) => number;

/**
 * The estimator, fetched once per session and shared by every mount.
 *
 * Dynamic because it carries a dictionary: loading it with the page would put a corpus in front of every
 * founder who only wanted to sign in. Until it resolves the checklist works and the bar stays empty,
 * which is the honest state — nothing has been judged yet.
 */
let scorer: Promise<Scorer> | null = null;

function loadScorer(): Promise<Scorer> {
  scorer ??= (async () => {
    const [{ ZxcvbnFactory }, { adjacencyGraphs, dictionary }] = await Promise.all([
      import("@zxcvbn-ts/core"),
      import("@zxcvbn-ts/language-common")
    ]);
    // The common dictionary and keyboard graphs are what separate this from counting characters: they
    // are how `Qwerty123!` is recognised as a walk across the keyboard rather than four classes met.
    const estimator = new ZxcvbnFactory({ dictionary, graphs: adjacencyGraphs });
    return (password: string) => estimator.check(password).score;
  })();
  return scorer;
}

/**
 * A password box with its own reveal toggle.
 *
 * Both fields get one, and each controls only itself: the button sits inside a field, so making it act
 * on the other one as well would be a surprise. Two independent toggles also let a founder check the
 * repeat against a still-hidden original, which is the whole point of typing it twice.
 */
function RevealableInput({
  id,
  label,
  inputRef,
  value,
  onChange,
  describedBy,
  invalid,
  autoFocus
}: {
  id: string;
  label: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (value: string) => void;
  describedBy?: string;
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        id={id}
        name={id}
        type={revealed ? "text" : "password"}
        className="pr-10"
        autoComplete="new-password"
        required
        autoFocus={autoFocus}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        onClick={() => setRevealed((shown) => !shown)}
        // Named after the field it belongs to: two buttons both called "Show password" would leave a
        // screen-reader user with no way to tell which box they are about to reveal.
        aria-label={`${revealed ? "Hide" : "Show"} ${label.toLowerCase()}`}
        aria-pressed={revealed}
        className="absolute inset-y-0 right-0 flex w-10 cursor-pointer items-center justify-center text-fg-faint transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {revealed ? (
          <EyeOff className="size-4" aria-hidden="true" />
        ) : (
          <Eye className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

export function PasswordFields() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [score, setScore] = useState<number | null>(null);

  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmationRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!password) {
      setScore(null);
      return;
    }
    let current = true;
    void loadScorer().then((rate) => {
      if (current) setScore(rate(password));
    });
    return () => {
      current = false;
    };
  }, [password]);

  const unmet = unmetPasswordRules(password);
  const tooWeak = score !== null && score < MIN_SCORE;
  // Silent until they have typed something to compare — an empty second field is unfinished, not wrong.
  const mismatch = confirmation.length > 0 && confirmation !== password;

  /*
   * Blocking submit through the browser's own constraint validation, rather than by disabling a button
   * this component does not own. It keeps the form a plain server-action form, and it degrades the right
   * way: with JavaScript off none of this runs and `signupAction` still refuses (§ acceptance criteria).
   *
   * No dependency array — every one of these values changes together, and setting the same string twice
   * costs nothing.
   */
  useEffect(() => {
    const problem = unmet.length > 0 ? "Your password does not meet all the requirements yet." : "";
    passwordRef.current?.setCustomValidity(
      problem || (tooWeak ? "Choose a password that is harder to guess." : "")
    );
    confirmationRef.current?.setCustomValidity(mismatch ? "The two passwords do not match." : "");
  });

  // `?? STRENGTH[0]` only satisfies the compiler: zxcvbn's scale is 0–4 and `STRENGTH` has five entries.
  const strength = STRENGTH[score ?? 0] ?? STRENGTH[0];

  return (
    <>
      <div>
        <Label htmlFor="password">Password</Label>
        <RevealableInput
          id="password"
          label="Password"
          inputRef={passwordRef}
          value={password}
          onChange={setPassword}
          describedBy="password-requirements"
        />

        <div className="mt-2 flex items-center gap-2">
          <Progress
            value={score === null ? 0 : ((score + 1) / STRENGTH.length) * 100}
            indicatorClassName={strength.indicator}
            aria-label="Password strength"
          />
          <span className="w-12 shrink-0 text-2xs text-fg-muted">
            {score === null ? "" : strength.label}
          </span>
        </div>

        <ul id="password-requirements" className="mt-2 space-y-1">
          {PASSWORD_RULES.map((rule) => {
            const met = !unmet.includes(rule.id);
            return (
              <li
                key={rule.id}
                className={`flex items-center gap-1.5 text-2xs ${met ? "text-success" : "text-fg-faint"}`}
              >
                <Check className="size-3 shrink-0" aria-hidden="true" />
                {rule.label}
                <span className="sr-only">{met ? " — done" : " — still needed"}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <Label htmlFor="confirmPassword">Repeat password</Label>
        <RevealableInput
          id="confirmPassword"
          label="Repeat password"
          inputRef={confirmationRef}
          value={confirmation}
          onChange={setConfirmation}
          invalid={mismatch}
          describedBy={mismatch ? "confirm-error" : undefined}
        />
        {mismatch ? (
          <p id="confirm-error" className="mt-1.5 text-2xs text-danger">
            The two passwords do not match.
          </p>
        ) : null}
      </div>
    </>
  );
}
