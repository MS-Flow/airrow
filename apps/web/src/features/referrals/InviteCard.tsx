// The invite surface in Settings (spec 122): the link, what it is worth, and where each invitation
// has got to.
//
// Presentational and server-rendered — the summary and the link are handed in, so this file cannot
// accidentally start a week or query anything. The page above it is where the data comes from.
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyBlock } from "@/features/delivery/CopyBlock";
import { REFERRAL_CAP, REFERRAL_GRANT_DAYS, type ReferralSummary } from "@/lib/data/referrals";

/** `2026-08-06` from an ISO timestamp — the same shape the plan standing uses. */
const day = (iso: string): string => iso.slice(0, 10);

/**
 * What one invitation currently means. Three states, said plainly, because the gap between sending a
 * link and being paid for it is days long and silence in between reads as a broken feature.
 */
function inviteLine(invite: ReferralSummary["invites"][number]): string {
  if (invite.state === "joined") {
    return `${invite.name} signed up — waiting for their first foundation.`;
  }
  return invite.uncredited
    ? `${invite.name} generated their foundation, after your last place was used.`
    : `${invite.name} generated their foundation — ${REFERRAL_GRANT_DAYS} days of Pro credited.`;
}

export function InviteCard({ summary, link }: { summary: ReferralSummary; link: string }) {
  const { activeUntil, invites, queued, remaining } = summary;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          Invite a friend
          <Badge tone={remaining > 0 ? "accent" : "neutral"}>
            {remaining} of {REFERRAL_CAP} left
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardBody>
        <p className="max-w-prose text-sm leading-relaxed text-fg-muted">
          Send this link. When someone who used it generates their first foundation, you get{" "}
          {REFERRAL_GRANT_DAYS} days of Pro — up to {REFERRAL_CAP} times. They get the ordinary free
          workspace; this is a thank-you, not a discount, and nothing about it is charged to them.
        </p>

        {remaining > 0 ? (
          <CopyBlock text={link} mono={false} />
        ) : (
          <p className="mt-3 text-sm text-fg-muted">
            You have used all {REFERRAL_CAP} places. Keep recommending us anyway — we would rather
            owe you than cap you, and there is a way to say thank you properly if you do.
          </p>
        )}

        {activeUntil ? (
          <p className="mt-3 text-sm text-success">
            Pro from an invitation, until {day(activeUntil)}.
          </p>
        ) : null}

        {queued > 0 ? (
          <p className="mt-2 text-xs leading-relaxed text-fg-faint">
            {queued === 1 ? "One week is" : `${queued} weeks are`} waiting. Nothing counts down until
            you next generate or import something — a week you earned is not spent while you are not
            using it.
          </p>
        ) : null}

        {invites.length > 0 ? (
          <ul className="mt-4 space-y-2 border-t border-border pt-4">
            {invites.map((invite) => (
              <li key={invite.attachedAt} className="text-sm text-fg-muted">
                <span className="font-mono text-xs text-fg-faint">{day(invite.attachedAt)}</span>{" "}
                {inviteLine(invite)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 border-t border-border pt-4 text-xs text-fg-faint">
            Nobody has used your link yet. It never expires, so it is worth sending once and
            forgetting about.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
