"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { login } from "@/lib/actions/auth";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";

export function LoginForm({ locale }: { locale: string }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginInput) {
    setServerError(null);
    setPending(true);
    const formData = new FormData();
    formData.set("email", data.email);
    formData.set("password", data.password);
    const result = await login(locale, formData);
    setPending(false);
    if (result?.error) setServerError(result.error);
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mx-auto flex max-w-sm flex-col gap-4 rounded-lg border border-border bg-white p-6 shadow-sm"
    >
      <TextField label="Email" type="email" {...register("email")} error={errors.email?.message} />
      <TextField label="Пароль" type="password" {...register("password")} error={errors.password?.message} />
      {serverError && (
        <div className="rounded-sm border border-error bg-error-bg px-3 py-2 font-body text-[13px] text-error">
          {serverError}
        </div>
      )}
      <Button type="submit" loading={pending}>
        Войти
      </Button>
      <a href={`/${locale}/register`} className="text-center font-body text-[13px] text-ink-muted underline">
        Ещё нет аккаунта? Зарегистрироваться
      </a>
    </form>
  );
}
