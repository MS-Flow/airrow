"use client";

// The signed-in interview: the shared runtime bound to a real project's server actions.
import type { AnswerId, InterviewAnswers } from "@airrow/schemas";
import { DeleteProjectDialog } from "@/features/projects/DeleteProjectDialog";
import { deleteProjectAction } from "@/features/projects/actions";
import { InterviewRuntime } from "./InterviewRuntime";
import { saveAnswersAction, submitInterviewAction } from "./actions";
import {
  listReferencesAction,
  removeReferenceAction,
  uploadReferenceAction
} from "./references-action";

export function AuthedInterview({
  projectId,
  projectName,
  initialAnswers,
  regenerating = false,
  rejectedAnswers = null
}: {
  projectId: string;
  projectName: string;
  initialAnswers: InterviewAnswers;
  regenerating?: boolean;
  /** The answers the last run was refused for, if it was — spec 128. */
  rejectedAnswers?: AnswerId[] | null;
}) {
  return (
    <InterviewRuntime
      projectName={projectName}
      mode="account"
      initialAnswers={initialAnswers}
      regenerating={regenerating}
      rejectedAnswers={rejectedAnswers}
      persist={(answers) => void saveAnswersAction(projectId, answers)}
      submit={(answers) => submitInterviewAction(projectId, answers)}
      // Screenshots hang off a real project, which is exactly what the signed-in path has and the
      // guest path does not (spec 159).
      uploads={{
        list: () => listReferencesAction(projectId),
        upload: (form) => uploadReferenceAction(projectId, form),
        remove: (referenceId) => removeReferenceAction(projectId, referenceId)
      }}
      // A project exists from the moment the interview does, so the way out has to exist there too.
      // Until now it lived only on the project page, which a founder whose answers were refused has
      // no reason to visit — they are looking at the review screen, deciding whether this project is
      // worth rewriting. Injected like everything else that needs a real project: the runtime is
      // shared with the guest interview, which has nothing to delete.
      destroy={
        <DeleteProjectDialog
          projectId={projectId}
          projectName={projectName}
          action={deleteProjectAction}
        />
      }
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
