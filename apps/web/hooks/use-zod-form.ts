"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormProps, type UseFormReturn } from "react-hook-form";
import { ZodTypeAny, z } from "zod";

export function useZodForm<TSchema extends ZodTypeAny>(
  schema: TSchema,
  options?: UseFormProps<z.infer<TSchema>>
): UseFormReturn<z.infer<TSchema>> {
  return useForm({
    resolver: zodResolver(schema),
    mode: "onChange",
    ...options,
  });
}
