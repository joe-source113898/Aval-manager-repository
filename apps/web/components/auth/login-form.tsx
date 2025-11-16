"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { toast } from "sonner";

import { FormField } from "@/components/forms/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useZodForm } from "@/hooks/use-zod-form";
import { loginSchema } from "@/lib/schemas";
import { getRoleFromUser, isAdminRole } from "@/lib/auth";

interface LoginFormProps {
  intent?: "admin" | "asesor";
}

export function LoginForm({ intent = "admin" }: LoginFormProps) {
  const router = useRouter();
  const { supabaseClient } = useSessionContext();
  const [loading, setLoading] = useState(false);

  const form = useZodForm(loginSchema, {
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    setLoading(true);
    const { error } = await supabaseClient.auth.signInWithPassword(values);
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }

    const { data, error: userError } = await supabaseClient.auth.getUser();
    setLoading(false);
    if (userError || !data?.user) {
      toast.error("No fue posible determinar tu rol. Intenta nuevamente.");
      return;
    }

    const role = getRoleFromUser(data.user);

    if (isAdminRole(role)) {
      toast.success("Sesión iniciada como administrador");
      router.replace("/admin");
      return;
    }

    if (intent === "admin") {
      toast.warning("Tu cuenta pertenece al rol asesor. Te redirigimos a la vista pública.");
    } else {
      toast.success("Sesión iniciada como asesor");
    }
    router.replace("/calendario");
  });

  const buttonLabel = intent === "asesor" ? "Entrar a la vista pública" : "Iniciar sesión";

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <FormField control={form.control} name="email" label="Correo">
        {(field) => <Input type="email" autoComplete="email" placeholder="correo@dominio.com" {...field} />}
      </FormField>
      <FormField control={form.control} name="password" label="Contraseña">
        {(field) => <Input type="password" autoComplete="current-password" {...field} />}
      </FormField>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Accediendo..." : buttonLabel}
      </Button>
    </form>
  );
}
