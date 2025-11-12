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

export function LoginForm() {
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
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Sesión iniciada");
    router.replace("/admin");
  });

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <FormField control={form.control} name="email" label="Correo">
        {(field) => <Input type="email" autoComplete="email" placeholder="correo@dominio.com" {...field} />}
      </FormField>
      <FormField control={form.control} name="password" label="Contraseña">
        {(field) => <Input type="password" autoComplete="current-password" {...field} />}
      </FormField>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Accediendo..." : "Iniciar sesión"}
      </Button>
    </form>
  );
}
