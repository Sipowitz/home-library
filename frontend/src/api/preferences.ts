import client from "./client";

import type { Preferences, PreferencesUpdate } from "../types/preferences";

// -------------------
// 📥 GET
// -------------------

export async function fetchPreferences(): Promise<Preferences> {
  const res = await client.get("/preferences");

  return res.data;
}

// -------------------
// ✏️ UPDATE
// -------------------

export async function updatePreferences(
  data: PreferencesUpdate,
): Promise<Preferences> {
  const res = await client.put("/preferences", data);

  return res.data;
}
