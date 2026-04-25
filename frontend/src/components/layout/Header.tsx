import { Book as BookIcon, LogOut, Settings } from "lucide-react";

type Props = {
  onOpenSettings: () => void;
  onLogout: () => void;
};

export function Header({ onOpenSettings, onLogout }: Props) {
  return (
    <div className="flex justify-between items-center mb-8">
      <h1 className="text-2xl flex items-center gap-2 font-semibold">
        <BookIcon /> My Library
      </h1>

      <div className="flex gap-3">
        <button onClick={onOpenSettings}>
          <Settings size={20} />
        </button>
        <button onClick={onLogout}>
          <LogOut />
        </button>
      </div>
    </div>
  );
}
