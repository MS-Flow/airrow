// Create Project — step one of the wizard: the basics, then the interview.
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { InlineError } from "@/components/ui/states";
import { createProjectAction } from "@/features/projects/actions";

export const metadata = { title: "New project" };

export default async function NewProject({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-xl animate-slide-up px-6 py-16 md:px-8">
      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-xs text-fg-faint">Step 1 of 2 — the basics</p>
        <Progress value={50} aria-label="Setup progress" className="w-32" />
      </div>

      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-fg">What are you building?</h1>
      <p className="mt-2 text-base leading-relaxed text-fg-muted">
        A name and one honest paragraph. The CTO interview comes next — it takes about ten minutes
        and shapes everything Airrow generates.
      </p>

      {error ? (
        <InlineError className="mt-5">
          A name (min 2 chars) and a description (min 10 chars) are required.
        </InlineError>
      ) : null}

      <Card className="mt-6">
        <CardBody className="p-6">
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
              <Button type="submit" size="lg">
                Continue to interview
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
