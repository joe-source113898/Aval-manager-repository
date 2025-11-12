import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

import { env } from "@/lib/env";

export function getServerSupabase() {
  const cookieStore = cookies();

  return createServerComponentClient(
    { cookies: () => cookieStore },
    {
      supabaseUrl: env.supabaseUrl,
      supabaseKey: env.supabaseAnonKey,
    }
  );
}
