import { redirect } from "next/navigation";

export default function AdminPagosPage() {
  redirect("/admin/firmas?tab=pagos");
}
