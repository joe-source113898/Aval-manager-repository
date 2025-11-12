"use client";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Session, SupabaseClient } from "@supabase/supabase-js";
import { ReactNode, useMemo } from "react";
import { SessionContextProvider } from "@supabase/auth-helpers-react";

import { env } from "@/lib/env";

interface Props {
  initialSession: Session | null;
  children: ReactNode;
}

export function SupabaseProvider({ initialSession, children }: Props) {
  const client = useMemo(() => {
    return createClientComponentClient({
      supabaseUrl: env.supabaseUrl,
      supabaseKey: env.supabaseAnonKey,
    });
  }, []);

  return (
    <SessionContextProvider supabaseClient={client as SupabaseClient} initialSession={initialSession}>
      {children}
    </SessionContextProvider>
  );
}
