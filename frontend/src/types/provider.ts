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
