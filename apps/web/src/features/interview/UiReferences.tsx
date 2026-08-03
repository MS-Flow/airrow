"use client";

// The reference screen: links the founder pastes, and screenshots they attach (spec 159).
//
// Two kinds of reference, one screen, and they are stored in two different places for a reason the
// interface has to make invisible: the links are an ordinary answer, and the images are rows in the
// database because bytes have no business in an object rewritten on every keystroke.
//
// A guest gets the links and nothing else. The signed-out interview writes nothing server-side before
// it is claimed, and a screenshot is not a good enough reason to open the first unauthenticated write
// path — so this says so, plainly, rather than showing a control that would fail.
import * as React from "react";
import Image from "next/image";
import { ImagePlus, X } from "lucide-react";
import { MAX_UI_REFERENCE_IMAGES, MAX_UI_REFERENCE_LINKS, UI_REFERENCE_MEDIA_TYPES } from "@airrow/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InlineError } from "@/components/ui/states";
import { Spinner } from "@/components/ui/spinner";
import type { ReferenceView } from "./references-action";

/**
 * Uploading, injected rather than imported — the same reason `persist` and `submit` are: the guest
 * interview runs the identical screen with no server behind it, and `undefined` here is what "you
 * are not signed in" looks like to this component.
 */
export interface ReferenceUploads {
  list: () => Promise<ReferenceView[]>;
  upload: (form: FormData) => Promise<{ error?: string }>;
  remove: (referenceId: string) => Promise<{ error?: string }>;
}

interface Props {
  links: string;
  onLinksChange: (value: string) => void;
  maxChars?: number;
  placeholder?: string;
  uploads?: ReferenceUploads;
}

export function UiReferences({ links, onLinksChange, maxChars, placeholder, uploads }: Props) {
  const [images, setImages] = React.useState<ReferenceView[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);

  const refresh = React.useCallback(async () => {
    if (!uploads) return;
    setImages(await uploads.list());
  }, [uploads]);

  // Loading what is already attached, not fetching page data: this list is the founder's own prior
  // uploads and exists only once the screen is on the client.
  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  async function attach(file: File): Promise<void> {
    if (!uploads) return;
    setError(null);
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const result = await uploads.upload(form);
      if (result.error) setError(result.error);
      else await refresh();
    } finally {
      setBusy(false);
      // Cleared either way, so attaching the same file twice after a refusal still fires a change.
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function detach(referenceId: string): Promise<void> {
    if (!uploads) return;
    setBusy(true);
    try {
      const result = await uploads.remove(referenceId);
      if (result.error) setError(result.error);
      else await refresh();
    } finally {
      setBusy(false);
    }
  }

  const full = images.length >= MAX_UI_REFERENCE_IMAGES;

  return (
    <div className="grid gap-6">
      <div>
        <label htmlFor="ui-reference-links" className="text-sm text-fg-muted">
          Products whose look you like — up to {MAX_UI_REFERENCE_LINKS}, separated by spaces
        </label>
        <Input
          id="ui-reference-links"
          className="mt-2"
          value={links}
          placeholder={placeholder}
          maxLength={maxChars}
          onChange={(event) => onLinksChange(event.target.value)}
        />
      </div>

      <div>
        <p className="text-sm text-fg-muted">
          Screenshots — up to {MAX_UI_REFERENCE_IMAGES}, PNG, JPG or WebP
        </p>

        {uploads ? (
          <>
            {images.length > 0 ? (
              <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {images.map((image) => (
                  <li
                    key={image.id}
                    className="group relative aspect-video overflow-hidden rounded-md border border-border bg-surface"
                  >
                    {/* The founder's own upload, shown back to the founder who uploaded it, through a
                        signed URL that expires. It is an image and only ever an image — nothing here
                        renders anything a file could carry as markup. */}
                    {image.url ? (
                      <Image
                        src={image.url}
                        alt=""
                        fill
                        unoptimized
                        sizes="(max-width: 640px) 50vw, 25vw"
                        className="object-cover"
                      />
                    ) : null}
                    <button
                      type="button"
                      aria-label="Remove this reference"
                      onClick={() => void detach(image.id)}
                      disabled={busy}
                      className="absolute right-1 top-1 flex size-6 cursor-pointer items-center justify-center rounded-md bg-bg/80 text-fg-muted backdrop-blur-sm transition-colors hover:text-fg"
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <input
              ref={fileInput}
              type="file"
              accept={UI_REFERENCE_MEDIA_TYPES.join(",")}
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void attach(file);
              }}
            />
            <Button
              type="button"
              variant="secondary"
              className="mt-3"
              disabled={busy || full}
              onClick={() => fileInput.current?.click()}
            >
              {busy ? <Spinner className="size-4" /> : <ImagePlus className="size-4" />}
              {full ? "That's all four" : images.length > 0 ? "Add another" : "Attach a screenshot"}
            </Button>
          </>
        ) : (
          <p className="mt-2 rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-muted">
            Attaching screenshots needs an account — everything you've written is kept when you sign
            up, and you can add them then. The links above work either way.
          </p>
        )}

        {error ? <InlineError className="mt-3">{error}</InlineError> : null}
      </div>

      <p className="text-sm text-fg-faint">
        We read references as direction — the layout, the density, the feel — never as something to
        copy. Nothing here is fetched, published, or shown to anyone else.
      </p>
    </div>
  );
}
