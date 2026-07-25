import Link from "next/link";
import { MessageSquareQuote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";

export const metadata = { title: "Prompts" };

export default function PromptsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10 md:px-8">
      <h1 className="text-2xl font-semibold tracking-tight text-fg">Prompts</h1>
      <p className="mt-2 text-base text-fg-muted">
        The prompt library for every stage of AI-assisted development.
      </p>
      <EmptyState
        className="mt-8"
        icon={<MessageSquareQuote className="size-5" />}
        title="The prompt library lives in your foundation"
        description="Every generated repository ships with its own prompt library. A shared, editable library across projects is coming here."
        action={
          <Button variant="secondary" asChild>
            <Link href="/app">Back to dashboard</Link>
          </Button>
        }
      />
    </div>
  );
}
