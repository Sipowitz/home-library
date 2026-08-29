import { type ChangeEvent, useState } from "react";

import type { Location } from "../../types/location";
import type { Category } from "../../types/category";

import { LocationTreeSelector } from "../books/LocationTreeSelector";
import { CategoryTreeSelector } from "../books/CategoryTreeSelector";
import { ActionButton } from "../ui/ActionButton";

type Props = {
  searchInput: string;
  onSearchChange: (value: string) => void;
  isScrolling: boolean;

  selectedLocation: number | null;
  onLocationChange: (value: number | null) => void;

  selectedCategory: number | null;
  onCategoryChange: (value: number | null) => void;

  locations: Location[];
  categories: Category[];
  onCheckLibrary: () => void;
  onAddBook: () => void;
};

export function SearchBar({
  searchInput,
  onSearchChange,
  isScrolling,
  selectedLocation,
  onLocationChange,
  selectedCategory,
  onCategoryChange,
  locations,
  categories,
  onCheckLibrary,
  onAddBook,
}: Props) {
  const [hasFocusWithin, setHasFocusWithin] = useState(false);
  const [isPointerInteracting, setIsPointerInteracting] = useState(false);

  const shouldFade =
    isScrolling &&
    searchInput.trim().length === 0 &&
    !hasFocusWithin &&
    !isPointerInteracting;

  return (
    <div
      className={
        shouldFade
          ? "pointer-events-none opacity-0 transition-opacity duration-150 motion-reduce:duration-0"
          : "opacity-100 transition-opacity duration-150 motion-reduce:duration-0"
      }
      onFocusCapture={() => setHasFocusWithin(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setHasFocusWithin(false);
        }
      }}
      onPointerDownCapture={() => setIsPointerInteracting(true)}
      onPointerUpCapture={() => setIsPointerInteracting(false)}
      onPointerCancelCapture={() => setIsPointerInteracting(false)}
      onPointerLeave={() => setIsPointerInteracting(false)}
    >
      <div
        className="
          bg-surface/95 dark:bg-canvas/95
          backdrop-blur
          border border-border
          p-2 sm:p-2.5
          rounded-2xl
          shadow-lg
        "
      >
        <div className="flex flex-col gap-2 lg:grid lg:grid-cols-[minmax(0,1fr)_10rem] lg:items-stretch">
          <div className="flex min-w-0 flex-col gap-2">
            {/* SEARCH */}
            <input
              placeholder="Search title or author..."
              className="
                px-3 py-2.5
                bg-control
                text-text-primary
                placeholder:text-text-muted
                rounded-xl
                w-full
                outline-none
                border border-border-strong
                focus:border-focus
                focus:ring-2 focus:ring-focus/20
                transition
              "
              value={searchInput}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                onSearchChange(e.target.value)
              }
            />

            {/* FILTERS */}
            <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
              {/* LOCATION */}
              <div>
                <LocationTreeSelector
                  locations={locations}
                  selectedLocationId={selectedLocation}
                  onSelect={onLocationChange}
                  semanticTheme
                />
              </div>

              {/* CATEGORY */}
              <div>
                <CategoryTreeSelector
                  categories={categories}
                  selectedCategoryId={selectedCategory}
                  onSelect={onCategoryChange}
                  showSpecialOptions
                  semanticTheme
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-2 lg:grid lg:grid-rows-2 lg:border-l lg:border-t-0 lg:pl-2 lg:pt-0">
            <ActionButton variant="secondary" onClick={onCheckLibrary} className="flex-1 sm:flex-none lg:h-auto lg:w-full">Check Library</ActionButton>
            <ActionButton variant="addPrimary" onClick={onAddBook} className="flex-1 sm:flex-none lg:h-auto lg:w-full">+ Add Book</ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}
