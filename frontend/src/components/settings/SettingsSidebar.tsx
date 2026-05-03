// frontend/src/components/settings/SettingsSidebar.tsx

type Section = "locations" | "categories" | "backup";

type Props = {
  active: Section;
  onChange: (section: Section) => void;
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
    id: "backup",
    label: "Backup",
  },
];

export function SettingsSidebar({ active, onChange }: Props) {
  return (
    <>
      {/* ================= DESKTOP SIDEBAR ================= */}

      <div className="hidden lg:flex w-56 border-r border-gray-800 pr-3 flex-col space-y-1">
        {items.map((item) => {
          const selected = active === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={`
                w-full text-left px-3 py-2 rounded-lg transition
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

      <div className="lg:hidden mb-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {items.map((item) => {
            const selected = active === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onChange(item.id)}
                className={`
                  whitespace-nowrap px-4 py-2 rounded-lg transition text-sm
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
