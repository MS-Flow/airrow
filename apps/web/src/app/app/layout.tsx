import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutGrid, Settings } from "lucide-react";
import { ArrowMark } from "@/components/ui";
import { requireSession, signOut } from "@/lib/auth";

async function signOutAction() {
  "use server";
  await signOut();
  redirect("/");
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireSession();
  return (
    <div className="flex min-h-screen bg-bg">
      <aside className="fixed inset-y-0 left-0 flex w-56 flex-col border-r border-border bg-bg-subtle">
        <Link href="/app" className="flex items-center gap-2.5 px-5 py-5 text-fg">
          <ArrowMark className="text-accent" />
          <span className="text-[15px] font-semibold tracking-tight">Arrow</span>
        </Link>
        <nav className="flex-1 space-y-0.5 px-3">
          <Link
            href="/app"
            className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium text-fg-muted transition-colors hover:bg-surface hover:text-fg"
          >
            <LayoutGrid className="size-4" />
            Projects
          </Link>
          <Link
            href="/app/settings"
            className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium text-fg-muted transition-colors hover:bg-surface hover:text-fg"
          >
            <Settings className="size-4" />
            Settings
          </Link>
        </nav>
        <div className="border-t border-border p-4">
          <p className="truncate text-[13px] font-medium text-fg">{user.name}</p>
          <p className="truncate text-xs text-fg-faint">{user.email}</p>
          <form action={signOutAction} className="mt-2">
            <button
              type="submit"
              className="text-xs text-fg-muted transition-colors hover:text-fg cursor-pointer"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="ml-56 flex-1">{children}</main>
    </div>
  );
}
