import { Book as BookIcon, LogOut, Settings } from "lucide-react";
import { ActionButton } from "../ui/ActionButton";

type Props = {
  libraryName: string;
  onOpenSettings: () => void;
  onLogout: () => void;
};

export function Header({ libraryName, onOpenSettings, onLogout }: Props) {
  return (
    <div className="flex justify-between items-center mb-8">
      <h1 className="text-2xl flex items-center gap-2 font-semibold">
        <BookIcon /> {libraryName}
      </h1>

      <div className="flex gap-3">
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
