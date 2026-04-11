import React from "react";
import { toast } from "sonner";

/**
 * API utility functions for settings management
 */

export interface SettingsResponse {
  sitename: string;
  description: string;
  allow_cors: boolean;
  geo_ip_enabled: boolean;
  geo_ip_provider: string;
  o_auth_provider: string;
  o_auth_enabled: boolean;
  custom_head: string;
  CreatedAt: string;
  UpdatedAt: string;
  [key: string]: any;
}

/**
 * Fetch settings from the API
 * @returns Promise containing the settings data
 */
export async function getSettings(): Promise<SettingsResponse> {
  try {
    const response = await fetch("/api/admin/settings");

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Remove database metadata fields that are not needed for UI
    const { CreatedAt, UpdatedAt, id, ...settings } = data["data"];

    return settings as SettingsResponse;
  } catch (error) {
    console.error("Failed to fetch settings:", error);
    throw error;
  }
}

/**
 * Update settings via the API
 * @param settings - The settings object to update
 * @returns Promise containing the response
 */
export async function updateSettings(
  settings: Partial<SettingsResponse>
): Promise<void> {
  try {
    const response = await fetch("/api/admin/settings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(settings),
    });

    if (!response.ok) {
      try {
        const errorData = await response.json();
        console.log("Error response data:", errorData.message);
        throw new Error(
          `${errorData['message']}`
        );
      } catch (jsonError) {
        throw jsonError
      }
    }
  } catch (error) {
    console.error("Failed to update settings:", error);
    throw error;
  }
}
export async function updateSettingsWithToast(
  settings: Partial<SettingsResponse>,
  t: (key: string) => string
): Promise<void> {
  try {
    await updateSettings(settings);
    toast.success(t("settings.settings_saved"));
  } catch (error) {
    toast.error(t("settings.settings_save_failed") + ": " + error);
    throw error;
  }
}

/**
 * Update a single setting field
 * @param key - The setting key to update
 * @param value - The new value for the setting
 * @param currentSettings - The current settings object (to merge with)
 * @returns Promise containing the response
 */
export async function updateSingleSetting<K extends keyof SettingsResponse>(
  key: K,
  value: SettingsResponse[K],
  currentSettings: SettingsResponse
): Promise<void> {
  const updatedSettings = { ...currentSettings, [key]: value };
  return updateSettings(updatedSettings);
}

/**
 * Hook for managing settings state and API calls
 */
export function useSettings() {
  const [settings, setSettings] = React.useState<SettingsResponse>({
    sitename: "",
    description: "",
    allow_cors: false,
    geo_ip_enabled: false,
    geo_ip_provider: "",
    o_auth_provider: "",
    o_auth_enabled: false,
    custom_head: "",
    CreatedAt: "",
    UpdatedAt: "",
  });

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch settings on mount
  React.useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getSettings();
        setSettings(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch settings"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  // Update a single setting
  const updateSetting = async <K extends keyof SettingsResponse>(
    key: K,
    value: SettingsResponse[K]
  ) => {
    try {
      await updateSingleSetting(key, value, settings);
      setSettings((prev) => ({ ...prev, [key]: value }));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Failed to update ${String(key)}`
      );
      throw err;
    }
  };

  // Update multiple settings
  const updateMultipleSettings = async (
    newSettings: Partial<SettingsResponse>
  ) => {
    try {
      const updatedSettings = { ...settings, ...newSettings };
      await updateSettings(updatedSettings);
      setSettings(updatedSettings);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update settings"
      );
      throw err;
    }
  };

  return {
    settings,
    loading,
    error,
    updateSetting,
    updateMultipleSettings,
    refetch: async () => {
      const data = await getSettings();
      setSettings(data);
    },
  };
}
