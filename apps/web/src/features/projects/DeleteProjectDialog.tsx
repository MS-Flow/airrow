"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";

export function DeleteProjectDialog({
  projectId,
  projectName,
  action
}: {
  projectId: string;
  projectName: string;
  action: (formData: FormData) => void;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="danger" size="sm" type="button">
          <Trash2 className="size-3.5" />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Delete project?"
        description={`This removes "${projectName}" — its interview, generated foundation and history. This can't be undone.`}
      >
        <div className="flex justify-end gap-2 px-5 py-4">
          <DialogClose asChild>
            <Button variant="secondary" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <form action={action}>
            <input type="hidden" name="projectId" value={projectId} />
            <Button variant="danger" size="sm" type="submit">
              <Trash2 className="size-3.5" />
              Delete project
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
