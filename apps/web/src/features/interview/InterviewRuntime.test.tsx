// The design question, after two questions became one (spec 159).
//
// The mechanic is the whole point and it is easy to get subtly wrong: picking a starting direction
// must write real words into the field the founder then owns — not select an option that lives
// somewhere else and quietly disagrees with what they typed. There is one answer at the end of this
// screen, and these tests are what say so.
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { interviewQuestions } from "@airrow/schemas";
import { InterviewRuntime } from "./InterviewRuntime";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const direction = interviewQuestions.find((q) => q.id === "uiDirection");
const preset = direction?.options?.find((o) => o.value === "calm_focused");

function renderInterview() {
  const submit = vi.fn(async () => undefined);
  render(
    <InterviewRuntime
      projectName="Loop CRM"
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
      persist={() => {}}
      submit={submit}
      submitLabel="Generate"
      pendingLabel="Starting…"
      back={{ href: "/app", label: "Back" }}
    />
  );
  return { submit };
}

/** Walk from the review screen to the design question, which is where every test here starts. */
async function openTheDesignQuestion(): Promise<HTMLTextAreaElement> {
  await userEvent.click(screen.getByLabelText("Edit How should it look and feel?"));
  const field = screen.getByRole("textbox");
  if (!(field instanceof HTMLTextAreaElement)) throw new Error("no design field");
  return field;
}

describe("the design question", () => {
  it("offers the starting directions and the field on one screen", async () => {
    renderInterview();
    const field = await openTheDesignQuestion();

    expect(screen.getByRole("heading", { name: "How should it look and feel?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Calm & focused/ })).toBeInTheDocument();
    expect(field).toHaveValue("");
  });

  it("writes the picked direction into the field, as the founder's own words to edit", async () => {
    renderInterview();
    const field = await openTheDesignQuestion();

    await userEvent.click(screen.getByRole("button", { name: /Calm & focused/ }));
    expect(field).toHaveValue(preset?.prefill);

    // And it is a field, not a label: what they add to it stays.
    await userEvent.type(field, " The inbox is the screen they live in.");
    expect(field.value).toContain("The inbox is the screen they live in.");
  });

  it("replaces the text when a different direction is picked, rather than appending", async () => {
    renderInterview();
    const field = await openTheDesignQuestion();

    await userEvent.click(screen.getByRole("button", { name: /Calm & focused/ }));
    await userEvent.click(screen.getByRole("button", { name: /Dense & operational/ }));

    expect(field.value.startsWith("Dense and operational")).toBe(true);
    expect(field.value).not.toContain("Calm and focused");
  });

  it("empties the field for a founder who wants none of them", async () => {
    renderInterview();
    const field = await openTheDesignQuestion();

    await userEvent.click(screen.getByRole("button", { name: /Calm & focused/ }));
    await userEvent.click(screen.getByRole("button", { name: /None of these/ }));

    expect(field).toHaveValue("");
  });

  it("can be skipped — it is optional, and optional now means it", async () => {
    renderInterview();
    await openTheDesignQuestion();

    expect(screen.getByRole("button", { name: "Skip" })).toBeEnabled();
  });
});
