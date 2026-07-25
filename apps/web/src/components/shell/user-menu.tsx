"use client";

import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger
} from "@/components/ui/dropdown";

export function UserMenu({
  name,
  email,
  signOutAction
}: {
  name: string;
  email: string;
  /** Server action — the sign-out itself stays on the server. */
  signOutAction: () => Promise<void>;
}) {
  return (
    <Dropdown>
      <DropdownTrigger className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface-raised text-2xs font-medium uppercase text-fg-muted">
          {name.slice(0, 1)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-fg">{name}</span>
          <span className="block truncate text-2xs text-fg-faint">{email}</span>
        </span>
      </DropdownTrigger>
      <DropdownContent align="start" side="top">
        <DropdownItem asChild>
          <Link href="/app/settings">
            <Settings className="size-4" />
            Settings
          </Link>
        </DropdownItem>
        <DropdownSeparator />
        <DropdownItem asChild>
          <form action={signOutAction}>
            <button type="submit" className="flex w-full cursor-pointer items-center gap-2.5">
              <LogOut className="size-4" />
              Sign out
            </button>
          </form>
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}
