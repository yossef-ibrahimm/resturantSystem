import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSettings, updateSettings, resetSettings } from "@/lib/api";
import { connectSocket, disconnectSocket, onSocketEvent } from "@/lib/socket";
import { useAuthStore, selectIsAuthenticated } from "@/stores/authStore";
import type { RestaurantSettings, UpdateSettingsInput } from "@/lib/types";

export function useSettingsQuery() {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore(selectIsAuthenticated);

  const query = useQuery<RestaurantSettings>({
    queryKey: ["settings"],
    queryFn: getSettings,
    staleTime: 300_000,
  });

  useEffect(() => {
    if (!isAuthenticated) return;

    connectSocket();
    const unsub = onSocketEvent("settings:updated", (data: unknown) => {
      queryClient.setQueryData(["settings"], data as RestaurantSettings);
    });

    return () => {
      unsub();
      disconnectSocket();
    };
  }, [isAuthenticated, queryClient]);

  return query;
}

export function useUpdateSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateSettingsInput) => updateSettings(data),
    onSuccess: (settings) => {
      queryClient.setQueryData(["settings"], settings);
    },
  });
}

export function useResetSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resetSettings,
    onSuccess: (settings) => {
      queryClient.setQueryData(["settings"], settings);
    },
  });
}
