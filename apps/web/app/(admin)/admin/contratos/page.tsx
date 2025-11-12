import { redirect } from "next/navigation";

export default function AdminContratosPage() {
  redirect("/admin/firmas?tab=contratos");
}
