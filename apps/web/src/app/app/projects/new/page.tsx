// Create Project wizard (F-205 FR-3): one card, one field pair, one action.
import { Button, Card, Input, Label, Textarea } from "@/components/ui";
import { createProjectAction } from "@/features/projects/actions";

export const metadata = { title: "New project" };

export default async function NewProject({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="mx-auto flex max-w-xl flex-col justify-center px-8 py-16">
      <p className="font-mono text-xs text-accent">Step 1 of 2 — the basics</p>
      <h1 className="mt-2 text-xl font-semibold tracking-tight text-fg">
        What are you building?
      </h1>
      <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">
        A name and one honest paragraph. The CTO interview comes next — it takes about ten
        minutes and shapes everything Arrow generates.
      </p>
      {error ? (
        <p className="mt-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger">
          A name (min 2 chars) and a description (min 10 chars) are required.
        </p>
      ) : null}
      <Card className="mt-6 p-6">
        <form action={createProjectAction} className="space-y-5">
          <div>
            <Label htmlFor="name">Project name</Label>
            <Input id="name" name="name" placeholder="e.g. Loop CRM" required autoFocus maxLength={80} />
          </div>
          <div>
            <Label htmlFor="description">What does it do, and for whom?</Label>
            <Textarea
              id="description"
              name="description"
              rows={4}
              required
              maxLength={2000}
              placeholder="e.g. A lightweight CRM that helps small agencies track client relationships and never miss a follow-up."
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit">Continue to interview</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
