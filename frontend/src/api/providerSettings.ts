import client from "./client";

import type { ProviderConnectionTest, ProviderSetting, ProviderSettingUpdate } from "../types/provider";

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

export async function testProviderConnection(providerName: string): Promise<ProviderConnectionTest> {
  const res = await client.post(`/provider-settings/${providerName}/test-connection`);
  return res.data;
}
