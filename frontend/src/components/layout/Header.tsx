import { Book as BookIcon, LogOut, Settings } from "lucide-react";
import { ActionButton } from "../ui/ActionButton";

type Props = {
  libraryName: string;
  onOpenSettings: () => void;
  onLogout: () => void;
};

export function Header({ libraryName, onOpenSettings, onLogout }: Props) {
  return (
    <div className="mb-8 flex min-w-0 items-center justify-between gap-3">
      <h1 className="flex min-w-0 flex-1 items-center gap-2 text-2xl font-semibold">
        <BookIcon className="shrink-0" />
        <span className="truncate">{libraryName}</span>
      </h1>

      <div className="flex shrink-0 gap-3">
        <ActionButton variant="icon" size="icon" onClick={onOpenSettings}>
          <Settings size={20} />
        </ActionButton>
        <ActionButton variant="icon" size="icon" onClick={onLogout}>
          <LogOut size={20} />
        </ActionButton>
      </div>
    </div>
  );
}
