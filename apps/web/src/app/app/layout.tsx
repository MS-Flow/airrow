import { redirect } from "next/navigation";
import { ChatSlot } from "@/components/shell/chat-slot";
import { RailProvider } from "@/components/shell/rail";
import { Sidebar } from "@/components/shell/sidebar";
import { ThemeSwitch } from "@/components/shell/theme-switch";
import { TopBar } from "@/components/shell/top-bar";
import { UserMenu } from "@/components/shell/user-menu";
import { CommandPalette, type CommandItem } from "@/components/ui/command-palette";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toast";
import { NAV_ITEMS } from "@/components/shell/nav-items";
import { ClaimGuestDraft } from "@/features/interview/ClaimGuestDraft";
import { requireSession, signOut } from "@/lib/auth";
import { readTheme } from "@/lib/theme";
import { listProjects } from "@/lib/data/store";

async function signOutAction() {
  "use server";
  await signOut();
  redirect("/");
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, org } = await requireSession();
  const projects = await listProjects(org.id);
  const theme = await readTheme();

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

  return (
    <TooltipProvider delayDuration={200}>
      <Toaster>
        <RailProvider>
          <Sidebar />
          {/* The column starts where the rail ends, so the top bar and the preview's file
              tree move with it. Centred page content opts back out to the viewport via
              `.viewport-column`, which is why it never shifts. `--rail` animates itself, so
              nothing here needs its own transition. */}
          <div className="flex min-w-0 flex-1 flex-col pl-(--rail)">
            <TopBar
              projectNames={projectNames}
              themeSwitch={<ThemeSwitch current={theme} />}
              userMenu={
                <UserMenu name={user.name} email={user.email} signOutAction={signOutAction} />
              }
            />
            <main className="flex-1">{children}</main>
          </div>
          <ChatSlot />
        </RailProvider>
        <CommandPalette items={commands} />
        <ClaimGuestDraft />
      </Toaster>
    </TooltipProvider>
  );
}
