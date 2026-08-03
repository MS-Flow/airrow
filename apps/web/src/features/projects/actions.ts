"use server";

// Project mutations (F-205). All org-scoped via session; Zod at the boundary.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { projectCreateSchema } from "@airrow/schemas";
import { slugify } from "@airrow/engine";
import { notifyProjectCreated } from "@/features/notifications/notify";
import { requireSession } from "@/lib/auth";
import { createProject, deleteProject, getProject } from "@/lib/data/store";

export async function createProjectAction(formData: FormData): Promise<void> {
  const { org } = await requireSession();
  const parsed = projectCreateSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description")
  });
  if (!parsed.success) redirect("/app/projects/new?error=1");
  const project = await createProject(org.id, parsed.data.name, parsed.data.description, slugify);
  // After the write and before the redirect — `redirect` throws to unwind, so anything after it
  // never runs (spec 203).
  notifyProjectCreated(org.name, project.name, "new");
  redirect(`/app/projects/${project.id}/interview`);
}

export async function deleteProjectAction(formData: FormData): Promise<void> {
  const { org } = await requireSession();
  const id = String(formData.get("projectId") ?? "");
  if (await getProject(org.id, id)) await deleteProject(org.id, id);
  revalidatePath("/app");
  redirect("/app");
}
