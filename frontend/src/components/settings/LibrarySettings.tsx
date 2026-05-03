import { LocationSettings } from "./LocationSettings";
import { CategorySettings } from "./CategorySettings";

import type { Category } from "../../api/categories";

type Location = {
  id: number;
  name: string;
  parent_id?: number;
  children?: Location[];
};

type Props = {
  locations: Location[];
  locationTree: Location[];

  newLocation: string;
  setNewLocation: (v: string) => void;

  parentId: number | "";
  setParentId: (v: number | "") => void;

  onAddLocation: () => void;
  onDeleteRequest: (id: number) => void;

  categories: Category[];

  newCategory: string;
  setNewCategory: (v: string) => void;

  categoryParentId: number | "";
  setCategoryParentId: (v: number | "") => void;

  onAddCategory: () => void;
  onDeleteCategory: (id: number) => void;
};

export function LibrarySettings({
  locations,
  locationTree,
  newLocation,
  setNewLocation,
  parentId,
  setParentId,
  onAddLocation,
  onDeleteRequest,
  categories,
  newCategory,
  setNewCategory,
  categoryParentId,
  setCategoryParentId,
  onAddCategory,
  onDeleteCategory,
}: Props) {
  return (
    <div className="space-y-8">
      {/* LOCATIONS */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Locations</h2>

          <p className="text-sm text-gray-400 mt-1">
            Organize where books are physically stored.
          </p>
        </div>

        <LocationSettings
          locations={locations}
          locationTree={locationTree}
          newLocation={newLocation}
          setNewLocation={setNewLocation}
          parentId={parentId}
          setParentId={setParentId}
          onAddLocation={onAddLocation}
          onDeleteRequest={onDeleteRequest}
        />
      </div>

      {/* CATEGORIES */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Categories</h2>

          <p className="text-sm text-gray-400 mt-1">
            Organize books by subject or collection.
          </p>
        </div>

        <CategorySettings
          categories={categories}
          newCategory={newCategory}
          setNewCategory={setNewCategory}
          categoryParentId={categoryParentId}
          setCategoryParentId={setCategoryParentId}
          onAddCategory={onAddCategory}
          onDeleteCategory={onDeleteCategory}
        />
      </div>
    </div>
  );
}
