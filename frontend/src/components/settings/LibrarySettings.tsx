import { useState } from "react";
import toast from "react-hot-toast";
import { usePreferences } from "../../hooks/usePreferences";

export function LibrarySettings() {
  const { preferences, updatePreferences, loading } = usePreferences();
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  if (loading || !preferences) return <div className="text-sm text-text-muted">Loading preferences...</div>;
  const currentPreferences = preferences;
  async function saveName() {
    const value = (nameDraft ?? currentPreferences.library_name).trim();
    if (!value || value.length > 60) { setNameDraft(currentPreferences.library_name); toast.error(!value ? "Library name must not be blank" : "Library name must be 60 characters or fewer"); return; }
    if (value === currentPreferences.library_name) return;
    try { await updatePreferences({ library_name: value }); setNameDraft(value); toast.success("Library name updated"); }
    catch (error) { console.error(error); setNameDraft(currentPreferences.library_name); toast.error("Failed to update library name"); }
  }
  return <div className="space-y-8">
    <div><label htmlFor="library-name" className="mb-3 block text-sm font-medium text-text-primary">Library Name</label><input id="library-name" maxLength={60} value={nameDraft ?? currentPreferences.library_name} onChange={(event) => setNameDraft(event.target.value)} onBlur={() => void saveName()} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} className="form-control w-full" /><p className="mt-2 text-sm text-text-muted">Shown in the browser title and Library heading.</p></div>
    <div className="rounded-xl border border-border bg-surface-muted/30 p-4"><label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={currentPreferences.show_collections_in_library} onChange={(event) => void updatePreferences({ show_collections_in_library: event.target.checked })} className="mt-1" /><span><span className="block text-sm font-medium text-text-primary">Show collections in Library</span><span className="mt-1 block text-sm text-text-muted">Show root Groups and Series alongside your Library book grid.</span></span></label>{currentPreferences.show_collections_in_library && <label className="mt-4 block text-sm font-medium text-text-primary">Root collection display<select value={currentPreferences.root_collection_display_mode} onChange={(event) => void updatePreferences({ root_collection_display_mode: event.target.value as "collections_only" | "collections_and_books" })} className="form-control mt-2 w-full"><option value="collections_only">Collections only</option><option value="collections_and_books">Collections + books</option></select></label>}</div>
    <div><h3 className="text-sm font-medium text-text-primary">Library Stats</h3><p className="mt-1 text-sm text-text-muted">Choose where the library statistics panel is displayed.</p><div className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-muted"><label className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 text-sm text-text-secondary"><span>Show Library Stats on desktop</span><input type="checkbox" checked={currentPreferences.show_stats_desktop} onChange={(event) => void updatePreferences({ show_stats_desktop: event.target.checked })} className="h-4 w-4 accent-blue-600" /></label><label className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 text-sm text-text-secondary"><span>Show Library Stats on mobile</span><input type="checkbox" checked={currentPreferences.show_stats_mobile} onChange={(event) => void updatePreferences({ show_stats_mobile: event.target.checked })} className="h-4 w-4 accent-blue-600" /></label></div></div>
  </div>;
}
