"use server";

// Project mutations (F-205). All org-scoped via session; Zod at the boundary.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { projectCreateSchema } from "@arrow/schemas";
import { slugify } from "@arrow/engine";
import { requireSession } from "@/lib/auth";
import { createProject, deleteProject, getProject } from "@/lib/data/store";

export async function createProjectAction(formData: FormData): Promise<void> {
  const { org } = await requireSession();
  const parsed = projectCreateSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description")
  });
  if (!parsed.success) redirect("/app/projects/new?error=1");
  const project = createProject(org.id, parsed.data.name, parsed.data.description, slugify);
  redirect(`/app/projects/${project.id}/interview`);
}

export async function deleteProjectAction(formData: FormData): Promise<void> {
  const { org } = await requireSession();
  const id = String(formData.get("projectId") ?? "");
  if (getProject(org.id, id)) deleteProject(org.id, id);
  revalidatePath("/app");
  redirect("/app");
}
