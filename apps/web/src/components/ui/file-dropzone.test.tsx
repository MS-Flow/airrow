// The dropzone is allowed to look like anything as long as the form still works: the field it
// submits must stay a real file input with the same name, and what the founder sees must match what
// that input actually holds — a filename shown for a field the browser has emptied is a lie.
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileDropzone } from "./file-dropzone";

function renderZone(props: Partial<React.ComponentProps<typeof FileDropzone>> = {}) {
  const onFileChange = vi.fn();
  const view = render(
    <FileDropzone
      id="archive"
      name="archive"
      accept=".zip,application/zip"
      required
      prompt="Drop your project here"
      noun="archive"
      hint="Up to 50 MB."
      onFileChange={onFileChange}
      {...props}
    />
  );
  return { onFileChange, view };
}

const field = (): HTMLInputElement => {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (input === null) throw new Error("no file input rendered");
  return input;
};

const zip = (name = "loop-crm.zip") => new File(["PK"], name, { type: "application/zip" });

/**
 * A real FileList — the only thing `input.files` and a drop event accept. jsdom has no
 * `DataTransfer` to build one, so it is borrowed from an input user-event has filled.
 */
async function fileListOf(...files: File[]): Promise<FileList> {
  const donor = document.createElement("input");
  donor.type = "file";
  donor.multiple = true;
  document.body.append(donor);
  await userEvent.upload(donor, files, { applyAccept: false });
  const list = donor.files;
  donor.remove();
  if (list === null) throw new Error("could not build a FileList");
  return list;
}

const dropOn = async (target: HTMLElement, ...files: File[]) =>
  fireEvent.drop(target, { dataTransfer: { files: await fileListOf(...files), types: ["Files"] } });

describe("FileDropzone", () => {
  it("submits through a real file input that keeps its name and stays required", () => {
    renderZone();
    expect(field().name).toBe("archive");
    expect(field().required).toBe(true);
    expect(field().accept).toBe(".zip,application/zip");
  });

  it("invites a file when nothing is chosen", () => {
    renderZone();
    expect(screen.getByText("Drop your project here")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Replace/ })).not.toBeInTheDocument();
  });

  it("shows the name and size of the chosen file", async () => {
    const { onFileChange } = renderZone();
    const user = userEvent.setup();

    await user.upload(field(), zip());

    expect(screen.getByText("loop-crm.zip")).toBeInTheDocument();
    expect(screen.getByText("2 B")).toBeInTheDocument();
    expect(onFileChange).toHaveBeenCalledWith(expect.objectContaining({ name: "loop-crm.zip" }));
  });

  it("lets the founder take the file back out again", async () => {
    const { onFileChange } = renderZone();
    const user = userEvent.setup();
    await user.upload(field(), zip());

    await user.click(screen.getByRole("button", { name: /Remove loop-crm.zip/ }));

    expect(screen.queryByText("loop-crm.zip")).not.toBeInTheDocument();
    expect(screen.getByText("Drop your project here")).toBeInTheDocument();
    expect(field().value).toBe("");
    expect(onFileChange).toHaveBeenLastCalledWith(null);
  });

  it("chooses a dropped archive, and hands it to the input the form submits", async () => {
    const { onFileChange } = renderZone();
    // jsdom only accepts a FileList of its own making, and offers no way to build one — so the
    // handover is observed at the setter instead of read back off the input.
    const handedOver = vi.fn();
    Object.defineProperty(field(), "files", { configurable: true, set: handedOver, get: () => null });

    await dropOn(screen.getByText("Drop your project here"), zip("dropped.zip"));

    expect(screen.getByText("dropped.zip")).toBeInTheDocument();
    expect(handedOver).toHaveBeenCalledOnce();
    expect(handedOver.mock.calls[0]?.[0]?.[0]?.name).toBe("dropped.zip");
    expect(onFileChange).toHaveBeenCalledWith(expect.objectContaining({ name: "dropped.zip" }));
  });

  it("refuses a dropped file that is not a .zip — a drop bypasses accept", async () => {
    const { onFileChange } = renderZone();

    await dropOn(screen.getByText("Drop your project here"), new File(["x"], "notes.txt", { type: "text/plain" }));

    expect(screen.getByRole("alert")).toHaveTextContent("That isn't a .zip archive.");
    expect(screen.queryByText("notes.txt")).not.toBeInTheDocument();
    expect(field().files?.length ?? 0).toBe(0);
    expect(onFileChange).toHaveBeenCalledWith(null);
  });

  it("refuses several archives at once rather than picking one by drop order", async () => {
    renderZone();

    await dropOn(screen.getByText("Drop your project here"), zip("a.zip"), zip("b.zip"));

    expect(screen.getByRole("alert")).toHaveTextContent("Drop one archive at a time.");
    expect(field().files?.length ?? 0).toBe(0);
  });

  it("shows a rejected submit as its own state", () => {
    renderZone({ error: "Choose your archive again — the file field clears after an error." });
    expect(screen.getByRole("alert")).toHaveTextContent("Choose your archive again");
  });

  it("stops naming a file once the submit has emptied the field — every time, not just the first", async () => {
    // The same failure twice running is the case that catches a control watching the error text:
    // the message never changes, but the field is cleared again all the same.
    const user = userEvent.setup();
    render(
      <form action={async () => undefined}>
        <FileDropzone
          id="archive"
          name="archive"
          prompt="Drop your project here"
          noun="archive"
          error="Choose your archive again — the file field clears after an error."
        />
        <button type="submit">Import</button>
      </form>
    );

    for (const name of ["first.zip", "second.zip"]) {
      await user.upload(field(), zip(name));
      expect(screen.getByText(name)).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Import" }));

      await waitFor(() => expect(screen.queryByText(name)).not.toBeInTheDocument());
      expect(screen.getByRole("alert")).toHaveTextContent("Choose your archive again");
    }
  });

  it("lets a fresh choice supersede the error from the last attempt", async () => {
    renderZone({ error: "Choose your archive again — the file field clears after an error." });
    const user = userEvent.setup();

    await user.upload(field(), zip());

    expect(screen.getByText("loop-crm.zip")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("describes the field with its hint", () => {
    renderZone();
    expect(field()).toHaveAccessibleDescription("Up to 50 MB.");
  });

  it("announces the chosen file", async () => {
    renderZone();
    const user = userEvent.setup();
    await user.upload(field(), zip());

    const live = document.querySelector('[aria-live="polite"]');
    expect(live).toHaveTextContent("loop-crm.zip selected");
  });
});
