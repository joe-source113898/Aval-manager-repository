import { redirect } from "next/navigation";

import { AdvisorPortal } from "@/components/asesores/portal";
import { getRoleFromSession, isAdminRole, isAdvisorRole } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase/server";

export default async function AsesoresPage() {
  const supabase = getServerSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login?view=asesor");
  }

  const role = getRoleFromSession(session);
  if (!isAdvisorRole(role) && !isAdminRole(role)) {
    redirect("/");
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <AdvisorPortal />
    </div>
  );
}
