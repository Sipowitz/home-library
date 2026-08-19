export interface ProviderSetting {
  id: number;

  provider_name: string;

  enabled: boolean;

  priority: number;

  has_api_key: boolean;

  timeout_seconds: number;

  max_retries: number;

  created_at: string;

  updated_at: string;
}

export interface ProviderSettingUpdate {
  enabled?: boolean;

  priority?: number;

  api_key?: string;
  clear_api_key?: boolean;

  timeout_seconds?: number;

  max_retries?: number;
}

export interface ProviderResult {
  provider: string;

  success: boolean;

  isbn: string;

  duration_ms: number;

  // Provider payloads are intentionally heterogeneous.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any> | null;

  error: string | null;
}
