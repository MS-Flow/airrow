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
import { navItems, SUSPENDED_ITEMS } from "@/components/shell/nav-items";
import { ClaimGuestDraft } from "@/features/interview/ClaimGuestDraft";
import { requireSessionEvenIfSuspended, signOut } from "@/lib/auth";
import { readTheme } from "@/lib/theme";
import { listProjects } from "@/lib/data/store";

async function signOutAction() {
  "use server";
  await signOut();
  redirect("/");
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // The layout tolerates a suspension so the two routes that survive one have a shell to render in;
  // every page under it still calls `requireSession` and still bounces (spec 164). What changes here
  // is only what gets *drawn* — a suspended founder handed the full sidebar would be looking at six
  // links that all lead to the same refusal, plus a command palette listing projects they cannot open.
  const { session, suspended } = await requireSessionEvenIfSuspended();
  const { user, org, isAdmin } = session;
  const projects = suspended ? [] : await listProjects(org.id);
  const theme = await readTheme();

  const projectNames = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  // Resolved once and handed to both consumers, so the admin entry cannot appear in one and not the
  // other — the whole reason this is a function of the session rather than two lists (spec 150).
  const nav = suspended ? SUSPENDED_ITEMS : navItems({ isAdmin });

  const commands: CommandItem[] = suspended
    ? []
    : [
        ...nav.map((n) => ({ id: `nav-${n.href}`, label: n.label, href: n.href, group: "Go to" })),
        {
          id: "action-new",
          label: "New project",
          href: "/app/projects/new",
          hint: "create",
          group: "Actions"
        },
        {
          id: "action-import",
          label: "Import an existing project",
          href: "/app/projects/import",
          hint: "import",
          group: "Actions"
        },
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
          <Sidebar items={nav} />
          {/* The column starts where the rail ends, so the top bar and the preview's file
              tree move with it. Centred page content opts back out to the viewport via
              `.viewport-column`, which is why it never shifts. `--rail` animates itself, so
              nothing here needs its own transition. */}
          <div className="flex min-w-0 flex-1 flex-col pl-(--rail)">
            <TopBar
              projectNames={projectNames}
              themeSwitch={<ThemeSwitch current={theme} />}
              userMenu={
                <UserMenu
                  name={user.name}
                  email={user.email}
                  signOutAction={signOutAction}
                  suspended={suspended}
                />
              }
            />
            <main className="flex-1">{children}</main>
          </div>
          <ChatSlot />
        </RailProvider>
        <CommandPalette items={commands} />
        {/* Claiming a draft creates a project, which is a write — so it does not run for an account
            that is not allowed to make any. The draft keeps until the suspension is lifted. */}
        {suspended ? null : <ClaimGuestDraft />}
      </Toaster>
    </TooltipProvider>
  );
}
