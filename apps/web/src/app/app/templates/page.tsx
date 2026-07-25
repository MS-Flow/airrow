import Link from "next/link";
import { LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";

export const metadata = { title: "Templates" };

export default function TemplatesPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10 md:px-8">
      <h1 className="text-2xl font-semibold tracking-tight text-fg">Templates</h1>
      <p className="mt-2 text-base text-fg-muted">
        Proven starting points — so a familiar product type skips half the interview.
      </p>
      <EmptyState
        className="mt-8"
        icon={<LayoutTemplate className="size-5" />}
        title="Templates are coming soon"
        description="Until then, every project starts from the adaptive interview, which already tailors the foundation to what you're building."
        action={
          <Button asChild>
            <Link href="/app/projects/new">Start a project</Link>
          </Button>
        }
      />
    </div>
  );
}
