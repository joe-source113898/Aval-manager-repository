"use client";

import { useCallback } from "react";

import { useApi } from "@/hooks/use-api";

type StorageSignResponse = {
  url: string;
  token: string;
  bucket: string;
  path: string;
  expires_at: string;
};

export function useStorageProxy() {
  const api = useApi<StorageSignResponse>();

  return useCallback(
    async (path?: string | null, bucket?: string, expiresIn = 3600): Promise<string | null> => {
      if (!path) return null;
      if (/^https?:\/\//i.test(path)) return path;
      const payload = {
        path,
        bucket,
        expires_in: expiresIn,
      };
      const response = await api("storage/sign", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return response.url ?? null;
    },
    [api]
  );
}
