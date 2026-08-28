import type { ComponentProps } from "react";
import { AddBookForm } from "./AddBookForm";
import { Dialog } from "../ui/Dialog";

type Props = ComponentProps<typeof AddBookForm> & { open: boolean; onClose: () => void };

export function AddBookDialog({ open, onClose, ...formProps }: Props) {
  return (
    <Dialog open={open} title="Add Book" onClose={onClose}>
      <div className="p-3 sm:p-5">
        <AddBookForm {...formProps} embedded />
      </div>
    </Dialog>
  );
}
