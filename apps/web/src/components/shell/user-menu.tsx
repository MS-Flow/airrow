"use client";

import { LayoutGrid, LogOut, Settings } from "lucide-react";
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
  signOutAction,
  suspended = false
}: {
  name: string;
  email: string;
  /** Server action — the sign-out itself stays on the server. */
  signOutAction: () => Promise<void>;
  /**
   * A suspended account keeps only sign-out (spec 164).
   *
   * The sidebar is already stripped to Support for them, and leaving Projects and Settings here
   * would put the same two dead ends back one click away — both bounce to `/app/suspended`.
   */
  suspended?: boolean;
}) {
  return (
    <Dropdown>
      {/* Avatar-only trigger: it anchors the top-right corner, so the name and address
          move into the menu rather than widening the bar. */}
      <DropdownTrigger
        aria-label="Account menu"
        className="flex cursor-pointer items-center rounded-full transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface-raised text-xs font-medium uppercase text-fg-muted">
          {name.slice(0, 1)}
        </span>
      </DropdownTrigger>
      <DropdownContent align="end" side="bottom">
        <div className="min-w-0 px-2 py-1.5">
          <p className="truncate text-sm font-medium text-fg">{name}</p>
          <p className="truncate text-2xs text-fg-faint">{email}</p>
        </div>
        <DropdownSeparator />
        {suspended ? null : (
          <>
            <DropdownItem asChild>
              <Link href="/app">
                <LayoutGrid className="size-4" />
                Projects
              </Link>
            </DropdownItem>
            <DropdownItem asChild>
              <Link href="/app/settings">
                <Settings className="size-4" />
                Settings
              </Link>
            </DropdownItem>
            <DropdownSeparator />
          </>
        )}
        {/* `onSelect` must be prevented: Radix closes the menu on select, which unmounts
            this form before the browser dispatches its submit event — the reason sign-out
            silently did nothing. Keeping the menu open lets the action fire; the redirect
            that follows tears the menu down anyway. */}
        <DropdownItem asChild onSelect={(event) => event.preventDefault()}>
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
