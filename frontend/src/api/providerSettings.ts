import client from "./client";

import type { ProviderSetting, ProviderSettingUpdate } from "../types/provider";

// -------------------
// 📥 GET ALL
// -------------------

export async function fetchProviderSettings(): Promise<ProviderSetting[]> {
  const res = await client.get("/provider-settings/");

  return res.data;
}

// -------------------
// ✏️ UPDATE
// -------------------

export async function updateProviderSetting(
  providerId: number,
  data: ProviderSettingUpdate,
): Promise<ProviderSetting> {
  const res = await client.put(`/provider-settings/${providerId}`, data);

  return res.data;
}
