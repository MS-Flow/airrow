// The design question, after two questions became one (spec 159).
//
// The mechanic is the whole point and it is easy to get subtly wrong: picking a starting direction
// must write real words into the field the founder then owns — not select an option that lives
// somewhere else and quietly disagrees with what they typed. There is one answer at the end of this
// screen, and these tests are what say so.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { interviewQuestions, type AnswerId, type InterviewAnswers } from "@airrow/schemas";
import { InterviewRuntime } from "./InterviewRuntime";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const analytics = vi.hoisted(() => ({
  captures: [] as { name: string; properties: Record<string, unknown> }[]
}));
vi.mock("@/features/analytics/client", () => ({
  captureClient: (name: string, properties: Record<string, unknown>) => {
    analytics.captures.push({ name, properties });
  }
}));

const direction = interviewQuestions.find((q) => q.id === "uiDirection");
const preset = direction?.options?.find((o) => o.value === "soft_minimal");

function renderInterview({
  persist = () => {},
  destroy,
  rejectedAnswers
}: {
  persist?: (answers: InterviewAnswers) => void;
  destroy?: React.ReactNode;
  rejectedAnswers?: AnswerId[];
} = {}) {
  const submit = vi.fn(async () => undefined);
  render(
    <InterviewRuntime
      destroy={destroy}
      rejectedAnswers={rejectedAnswers}
      projectName="Pied Piper"
      mode="account"
      // Seeded past every required question, so the interview opens on the design question itself.
      initialAnswers={{
        productType: "saas",
        problem: "Agencies lose follow-ups between email and spreadsheets.",
        vision: "The system of record every agency runs on.",
        mvpFocus: "Log a client and never miss a follow-up.",
        tenancy: "organizations",
        authModel: ["email_password"],
        capabilities: ["search"],
        framework: "nextjs",
        database: "supabase",
        hosting: "vercel",
        repoProvider: "github"
      }}
      persist={persist}
      submit={submit}
      submitLabel="Generate"
      pendingLabel="Starting…"
      back={{ href: "/app", label: "Back" }}
    />
  );
  return { submit };
}

/**
 * Walk from the review screen to the design question, which is where every test here starts.
 *
 * The textarea by name rather than `getByRole("textbox")`: the screen carries a second field since
 * spec 165 folded the references in, and the ambiguity that caused is the merge working.
 */
async function openTheDesignQuestion(): Promise<HTMLTextAreaElement> {
  await userEvent.click(screen.getByLabelText("Edit How should it look and feel?"));
  const field = screen.getAllByRole("textbox").find((el) => el instanceof HTMLTextAreaElement);
  if (!(field instanceof HTMLTextAreaElement)) throw new Error("no design field");
  return field;
}

// The top of the funnel (spec 182), which had no test until `/analyze` looked. The drop-off curve
// is the single most useful thing on the dashboard — "the interview is too long" is a claim you can
// only make with it — and it is entirely made of these two events.
describe("the funnel events", () => {
  beforeEach(() => {
    analytics.captures = [];
  });

  it("reports the interview starting, once, with which of the two it is", () => {
    renderInterview();

    expect(analytics.captures).toEqual([
      { name: "interview_started", properties: { mode: "account" } }
    ]);
  });

  it("reports the question just completed, with where it sat", async () => {
    renderInterview();
    await openTheDesignQuestion();
    analytics.captures = [];

    // "Skip", exactly — the review screen's "Skip to review →" is a different button, and a regex
    // matches both.
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));

    const step = analytics.captures.find((c) => c.name === "interview_step");
    expect(step?.properties).toMatchObject({ question: "uiDirection" });
    expect(step?.properties.index).toBeGreaterThan(0);
    expect(step?.properties.total).toBeGreaterThanOrEqual(
      Number(step?.properties.index)
    );
  });

  it("never carries what was typed into the question", async () => {
    // Interview answers are customer IP (§II). The event names the question; the answer stays in the
    // browser. `sanitize` enforces it too — this asserts the caller never even offers it.
    renderInterview();
    const field = await openTheDesignQuestion();
    await userEvent.type(field, "A CRM for veterinary clinics");
    analytics.captures = [];

    // The label flips to "Continue" once the field has text.
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    for (const capture of analytics.captures) {
      expect(JSON.stringify(capture.properties)).not.toContain("veterinary");
    }
  });
});

describe("the design question", () => {
  it("offers the starting directions and the field on one screen", async () => {
    renderInterview();
    const field = await openTheDesignQuestion();

    expect(screen.getByRole("heading", { name: "How should it look and feel?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Soft minimal/ })).toBeInTheDocument();
    expect(field).toHaveValue("");
  });

  it("writes the picked direction into the field, as the founder's own words to edit", async () => {
    renderInterview();
    const field = await openTheDesignQuestion();

    await userEvent.click(screen.getByRole("button", { name: /Soft minimal/ }));
    expect(field).toHaveValue(preset?.prefill);

    // And it is a field, not a label: what they add to it stays.
    await userEvent.type(field, " The inbox is the screen they live in.");
    expect(field.value).toContain("The inbox is the screen they live in.");
  });

  it("replaces the text when a different direction is picked, rather than appending", async () => {
    renderInterview();
    const field = await openTheDesignQuestion();

    await userEvent.click(screen.getByRole("button", { name: /Soft minimal/ }));
    await userEvent.click(screen.getByRole("button", { name: /Bold contrast/ }));

    expect(field.value.startsWith("Bold and high-contrast")).toBe(true);
    expect(field.value).not.toContain("Soft and minimal");
  });

  it("empties the field for a founder who wants none of them", async () => {
    renderInterview();
    const field = await openTheDesignQuestion();

    await userEvent.click(screen.getByRole("button", { name: /Soft minimal/ }));
    await userEvent.click(screen.getByRole("button", { name: /None of these/ }));

    expect(field).toHaveValue("");
  });

  it("can be skipped — it is optional, and optional now means it", async () => {
    renderInterview();
    await openTheDesignQuestion();

    expect(screen.getByRole("button", { name: "Skip" })).toBeEnabled();
  });
});

/* ── The pick is stored, because it now installs something (spec 165) ──────────────────────── */

describe("picking a direction picks a theme", () => {
  /** The answers as they would be saved right now. */
  function saved(persist: ReturnType<typeof vi.fn>): Record<string, unknown> {
    const last = persist.mock.calls.at(-1);
    if (!last) throw new Error("nothing was persisted");
    return last[0] as Record<string, unknown>;
  }

  it("records which one was picked, alongside the words it wrote", async () => {
    const persist = vi.fn();
    renderInterview({ persist });
    await openTheDesignQuestion();

    await userEvent.click(screen.getByRole("button", { name: /Soft minimal/ }));
    await vi.waitFor(() => expect(persist).toHaveBeenCalled());
    expect(saved(persist).uiKit).toBe("soft_minimal");
  });

  it("keeps the pick when the founder rewrites every word of the prose", async () => {
    // The regression this spec exists for. Spec 159 derived the pick from whether the text still
    // began with the prefill — which silently cancelled an install the moment they edited the
    // opening sentence. The pick is theirs until they unpick it.
    const persist = vi.fn();
    renderInterview({ persist });
    const field = await openTheDesignQuestion();

    await userEvent.click(screen.getByRole("button", { name: /Soft minimal/ }));
    await userEvent.clear(field);
    await userEvent.type(field, "Actually, something entirely my own.");

    await vi.waitFor(() => expect(saved(persist).uiDirection).toBe("Actually, something entirely my own."));
    expect(saved(persist).uiKit).toBe("soft_minimal");
  });

  it("swaps the theme when a different direction is picked", async () => {
    const persist = vi.fn();
    renderInterview({ persist });
    await openTheDesignQuestion();

    await userEvent.click(screen.getByRole("button", { name: /Soft minimal/ }));
    await userEvent.click(screen.getByRole("button", { name: /Stark & technical/ }));

    await vi.waitFor(() => expect(saved(persist).uiKit).toBe("stark_terminal"));
  });

  it("clears it for the founder's own words — the one option that unpicks", async () => {
    const persist = vi.fn();
    renderInterview({ persist });
    await openTheDesignQuestion();

    await userEvent.click(screen.getByRole("button", { name: /Soft minimal/ }));
    await userEvent.click(screen.getByRole("button", { name: /None of these/ }));

    await vi.waitFor(() => expect(saved(persist).uiKit).toBeUndefined());
  });

  it("asks for references on this same screen, not the one after it", async () => {
    // Spec 165 folded spec 159's separate references screen into the design question: everything
    // about how the product should look is asked once, in one place.
    renderInterview();
    await openTheDesignQuestion();

    expect(screen.getByLabelText(/Products whose look you like/)).toBeInTheDocument();
    expect(screen.getByText(/Screenshots/)).toBeInTheDocument();
  });

  it("keeps the links as an answer, though they are no longer a question", async () => {
    const persist = vi.fn();
    renderInterview({ persist });
    await openTheDesignQuestion();

    await userEvent.type(screen.getByLabelText(/Products whose look you like/), "linear.app");
    await vi.waitFor(() => expect(saved(persist).uiReferenceLinks).toBe("linear.app"));
  });

  it("shows each direction rather than only describing it", async () => {
    renderInterview();
    await openTheDesignQuestion();

    // Either a capture of the real blocks or the drawing generated from the same record — both are
    // pictures of this direction, and which one is showing depends on whether a capture was taken.
    const picker = screen.getByRole("button", { name: /Soft minimal/ });
    expect(picker.querySelector("img, svg")).not.toBeNull();
    // The option that installs nothing has nothing to show.
    const escape = screen.getByRole("button", { name: /None of these/ });
    expect(escape.querySelector("img, svg")).toBeNull();
  });
});

/* ── A way out from the screen where the decision is made (spec 165) ────────────────────────── */

describe("abandoning a project from the review screen", () => {
  it("offers deleting beside generating, for a project that has one", () => {
    renderInterview({ destroy: <button type="button">Delete</button> });

    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toBeInTheDocument();
  });

  it("still offers it when the answers were refused — the case it exists for", () => {
    // A founder looking at "these answers weren't accepted" is deciding between rewriting and
    // abandoning. Until now the only way out was a project page they had no reason to visit.
    renderInterview({
      destroy: <button type="button">Delete</button>,
      rejectedAnswers: ["problem"]
    });

    expect(screen.getByText(/weren't accepted/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("offers nothing to delete on the guest path, where there is no project yet", () => {
    renderInterview();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });
});
