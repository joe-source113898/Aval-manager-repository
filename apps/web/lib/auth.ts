import { Session, User } from "@supabase/supabase-js";

export type UserRole = "admin" | "service_role" | "asesor" | "unknown";

const ADMIN_ROLES = new Set(["admin", "super_admin"]);

const ADVISOR_ROLES = new Set(["asesor", "advisor"]);

function normalizeRole(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function getRoleFromUser(user?: Pick<User, "app_metadata" | "user_metadata"> | null): UserRole {
  if (!user) {
    return "unknown";
  }

  const { app_metadata: appMetadata = {}, user_metadata: userMetadata = {} } = user;
  const normalized =
    normalizeRole((appMetadata as Record<string, unknown>).role) ||
    normalizeRole((userMetadata as Record<string, unknown>).role) ||
    normalizeRole((userMetadata as Record<string, unknown>).rol);

  if (!normalized) {
    return "unknown";
  }
  if (normalized === "service_role") {
    return "service_role";
  }
  if (ADMIN_ROLES.has(normalized)) {
    return "admin";
  }
  if (ADVISOR_ROLES.has(normalized)) {
    return "asesor";
  }
  return "unknown";
}

export function getRoleFromSession(session?: Session | null): UserRole {
  return getRoleFromUser(session?.user);
}

export function isAdminRole(role: UserRole): boolean {
  return role === "admin" || role === "service_role";
}

export function isAdvisorRole(role: UserRole): boolean {
  return role === "asesor";
}
