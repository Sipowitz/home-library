export interface ProviderSetting {
  id: number;

  provider_name: string;

  enabled: boolean;

  priority: number;

  api_key: string | null;

  timeout_seconds: number;

  max_retries: number;

  created_at: string;

  updated_at: string;
}

export interface ProviderSettingUpdate {
  enabled?: boolean;

  priority?: number;

  api_key?: string;

  timeout_seconds?: number;

  max_retries?: number;
}

export interface ProviderResult {
  provider: string;

  success: boolean;

  isbn: string;

  duration_ms: number;

  data: Record<string, any> | null;

  error: string | null;
}
