"use client";

// The signed-in interview: the shared runtime bound to a real project's server actions.
import type { InterviewAnswers } from "@airrow/schemas";
import { InterviewRuntime } from "./InterviewRuntime";
import { saveAnswersAction, submitInterviewAction } from "./actions";

export function AuthedInterview({
  projectId,
  projectName,
  initialAnswers,
  regenerating = false
}: {
  projectId: string;
  projectName: string;
  initialAnswers: InterviewAnswers;
  regenerating?: boolean;
}) {
  return (
    <InterviewRuntime
      projectName={projectName}
      initialAnswers={initialAnswers}
      regenerating={regenerating}
      persist={(answers) => void saveAnswersAction(projectId, answers)}
      submit={(answers) => submitInterviewAction(projectId, answers)}
      submitLabel={regenerating ? "Regenerate foundation" : "Generate foundation"}
      pendingLabel="Starting generation…"
      back={
        regenerating
          ? { href: `/app/projects/${projectId}/preview`, label: "Back to the foundation" }
          : { href: "/app", label: "Back to projects" }
      }
    />
  );
}
