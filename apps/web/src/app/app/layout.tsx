import { redirect } from "next/navigation";
import { ChatSlot } from "@/components/shell/chat-slot";
import { Sidebar, type GeneratingProject } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/top-bar";
import { UserMenu } from "@/components/shell/user-menu";
import { CommandPalette, type CommandItem } from "@/components/ui/command-palette";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toast";
import { NAV_ITEMS } from "@/components/shell/nav-items";
import { requireSession, signOut } from "@/lib/auth";
import { latestJob, listProjects } from "@/lib/data/store";
import { JOB_STAGE_COUNT } from "@/features/generation/stages";

async function signOutAction() {
  "use server";
  await signOut();
  redirect("/");
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, org } = await requireSession();
  const projects = await listProjects(org.id);

  const projectNames = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  const commands: CommandItem[] = [
    ...NAV_ITEMS.map((n) => ({ id: `nav-${n.href}`, label: n.label, href: n.href, group: "Go to" })),
    { id: "action-new", label: "New project", href: "/app/projects/new", hint: "create", group: "Actions" },
    ...projects.map((p) => ({
      id: `project-${p.id}`,
      label: p.name,
      href: `/app/projects/${p.id}`,
      hint: p.status,
      group: "Projects"
    }))
  ];

  // The rail shows live progress for whichever project is generating right now.
  // Percent comes from the job's real stage count — never an invented number.
  const running = projects.find((p) => p.status === "generating");
  const runningJob = running ? await latestJob(running.id) : null;
  const generating: GeneratingProject | null = running
    ? {
        id: running.id,
        name: running.name,
        percent: runningJob ? (runningJob.stagesDone.length / JOB_STAGE_COUNT) * 100 : 0
      }
    : null;

  return (
    <TooltipProvider delayDuration={200}>
      <Toaster>
        <div className="flex min-h-screen bg-bg">
          <Sidebar
            generating={generating}
            footer={<UserMenu name={user.name} email={user.email} signOutAction={signOutAction} />}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar projectNames={projectNames} />
            <main className="flex-1">{children}</main>
          </div>
          <ChatSlot />
        </div>
        <CommandPalette items={commands} />
      </Toaster>
    </TooltipProvider>
  );
}
