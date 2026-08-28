type Section =
  | "locations"
  | "categories"
  | "providers"
  | "maintenance"
  | "backup"
  | "appearance"
  | "preferences"
  | "users";

type Props = {
  active: Section;

  onChange: (section: Section) => void;
  isAdmin: boolean;
};

const items: {
  id: Section;
  label: string;
}[] = [
  {
    id: "locations",
    label: "Locations",
  },

  {
    id: "categories",
    label: "Categories",
  },

  {
    id: "providers",
    label: "Providers",
  },
  {
    id: "maintenance",
    label: "Maintenance",
  },
  { id: "users", label: "Users" },

  {
    id: "appearance",
    label: "Appearance",
  },

  {
    id: "preferences",
    label: "Preferences",
  },

  {
    id: "backup",
    label: "Backup",
  },
];

export function SettingsSidebar({ active, onChange, isAdmin }: Props) {
  const visibleItems = items.filter((item) => isAdmin || (item.id !== "providers" && item.id !== "users"));
  return (
    <>
      {/* ================= DESKTOP SIDEBAR ================= */}

      <div
        className="
          hidden lg:flex
          w-56
          border-r border-gray-800
          pr-3
          flex-col
          space-y-1
        "
      >
        {visibleItems.map((item) => {
          const selected = active === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={`
                w-full text-left
                px-3 py-2
                rounded-lg
                transition
                ${
                  selected
                    ? "bg-gray-800 text-white"
                    : "text-gray-400 hover:bg-gray-800/60 hover:text-white"
                }
              `}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* ================= MOBILE TABS ================= */}

      <div className="lg:hidden min-w-0 mb-2">
        <div className="scrollbar-none flex w-full gap-2 overflow-x-auto overscroll-x-contain pb-1 touch-pan-x">
          {visibleItems.map((item) => {
            const selected = active === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onChange(item.id)}
                className={`
                  shrink-0 whitespace-nowrap
                  px-4 py-2
                  min-h-10
                  rounded-lg
                  transition
                  text-sm
                  ${
                    selected
                      ? "bg-gray-800 text-white"
                      : "bg-gray-900 text-gray-400"
                  }
                `}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
