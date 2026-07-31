"use client";

// The verdict, asked for where it is cheapest to give: at the bottom of the project page, once the
// foundation exists (spec 144).
//
// A client component for one reason — the stars light up as you move across them, and a rating you
// cannot see yourself choosing is a rating people get wrong. Everything else is an ordinary form
// posting to a server action, so the value that is submitted is the radio the founder selected.
import * as React from "react";
import { Star } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/choice";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineError } from "@/components/ui/states";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";

const STARS = [1, 2, 3, 4, 5] as const;

export interface ReviewDraft {
  rating: number;
  body: string;
  consentPublic: boolean;
  displayName: string;
}

export function ReviewCard({
  projectId,
  action,
  existing,
  defaultName,
  outcome
}: {
  projectId: string;
  action: (formData: FormData) => void;
  /** What the founder said last time, if they have said anything. */
  existing: ReviewDraft | null;
  /** Their account name — a suggestion for the public byline, never imposed. */
  defaultName: string;
  /** How the last submission from this page went, if there was one. */
  outcome: "saved" | "invalid" | null;
}) {
  const [rating, setRating] = React.useState(existing?.rating ?? 0);
  /** What the pointer is currently over, so the stars answer before the click. */
  const [preview, setPreview] = React.useState(0);
  const [consent, setConsent] = React.useState(existing?.consentPublic ?? false);
  const lit = preview || rating;

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>{existing ? "Your review" : "How was it?"}</CardTitle>
      </CardHeader>
      <CardBody>
        <p className="max-w-prose text-sm leading-relaxed text-fg-muted">
          {existing
            ? "You can change this whenever you like — the last thing you say is the one that stands."
            : "You have just seen what Airrow made you. A rating is enough; words help more. It goes straight to the people who build this."}
        </p>

        {outcome === "saved" ? (
          <p className="mt-3 text-sm text-success">Saved — thank you.</p>
        ) : null}
        {outcome === "invalid" ? (
          <InlineError className="mt-3">
            A rating between one and five stars is required, and the text has to fit in 1000
            characters.
          </InlineError>
        ) : null}

        <form action={action} className="mt-5 max-w-xl space-y-5">
          <input type="hidden" name="projectId" value={projectId} />

          <fieldset onMouseLeave={() => setPreview(0)}>
            <legend className="mb-1.5 block text-sm font-medium text-fg-muted">Your rating</legend>
            <div className="flex items-center gap-1">
              {STARS.map((value) => (
                <label
                  key={value}
                  onMouseEnter={() => setPreview(value)}
                  className="cursor-pointer p-1"
                >
                  <input
                    type="radio"
                    name="rating"
                    value={value}
                    checked={rating === value}
                    onChange={() => setRating(value)}
                    required
                    className="peer sr-only"
                  />
                  <Star
                    aria-hidden
                    className={cn(
                      "size-6 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent",
                      value <= lit ? "fill-warn text-warn" : "text-fg-faint"
                    )}
                  />
                  <span className="sr-only">{value} out of 5</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <Label htmlFor="review-body">In your own words (optional)</Label>
            <Textarea
              id="review-body"
              name="body"
              rows={4}
              maxLength={1000}
              defaultValue={existing?.body ?? ""}
              placeholder="What was useful, and what was not?"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-2.5">
              <Checkbox
                id="consentPublic"
                name="consentPublic"
                checked={consent}
                onCheckedChange={(value) => setConsent(value === true)}
                className="mt-0.5"
              />
              <Label htmlFor="consentPublic" className="mb-0 leading-relaxed">
                Airrow may quote this publicly
              </Label>
            </div>
            {consent ? (
              <div>
                <Label htmlFor="displayName">Shown as</Label>
                <Input
                  id="displayName"
                  name="displayName"
                  maxLength={80}
                  defaultValue={existing?.displayName || defaultName}
                  className="max-w-xs"
                />
                <p className="mt-1.5 text-xs text-fg-faint">
                  Only this name and what you wrote — never your address, your workspace or your
                  project. Nothing is published until we publish it, and you can withdraw this by
                  unticking the box.
                </p>
              </div>
            ) : null}
          </div>

          <SubmitButton pendingLabel="Saving…" disabled={rating === 0}>
            {existing ? "Update review" : "Send review"}
          </SubmitButton>
        </form>
      </CardBody>
    </Card>
  );
}
