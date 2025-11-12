"use client";

import { useSessionContext } from "@supabase/auth-helpers-react";
import { useCallback } from "react";

import { apiFetch } from "@/lib/api";

export function useApi<T = unknown>() {
  const { session } = useSessionContext();
  const token = session?.access_token;

  return useCallback(
    (path: string, options: RequestInit = {}) =>
      apiFetch<T>(path, {
        ...options,
        accessToken: token,
      }),
    [token]
  );
}
