"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";

// ─── Schemas de validación ───────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

const registerSchema = z
  .object({
    fullName: z.string().min(2, "Ingresa tu nombre completo"),
    clinicName: z.string().min(2, "Ingresa el nombre de la clínica"),
    email: z.string().email("Correo inválido"),
    password: z.string().min(8, "Mínimo 8 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

// ─── Componente ──────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ── Formulario de Login ──
  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  // ── Formulario de Registro ──
  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleLogin(data: LoginForm) {
    setLoading(true);
    setServerError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    setLoading(false);
    if (error) {
      setServerError(
        error.message === "Invalid login credentials"
          ? "Correo o contraseña incorrectos."
          : error.message
      );
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function handleRegister(data: RegisterForm) {
    setLoading(true);
    setServerError(null);

    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
          clinic_name: data.clinicName,
        },
      },
    });

    setLoading(false);
    if (error) {
      setServerError(error.message);
      return;
    }

    setSuccessMsg(
      "¡Cuenta creada! Revisa tu correo para confirmar tu dirección y luego inicia sesión."
    );
    setMode("login");
  }

  // ─── UI ──────────────────────────────────────────────────────────────────

  return (
    <div className="login-page">
      {/* Fondo con gradiente animado */}
      <div className="login-bg" aria-hidden="true" />

      {/* Card central */}
      <div className="login-card">
        {/* Logo / Brand */}
        <div className="login-brand">
          <div className="login-logo" aria-hidden="true">
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="40" height="40" rx="12" fill="hsl(196 80% 38%)" />
              <path
                d="M20 8c-3.3 0-6 2.7-6 6 0 2.1.7 4.1 2 5.6V28a4 4 0 0 0 8 0V19.6c1.3-1.5 2-3.5 2-5.6 0-3.3-2.7-6-6-6z"
                fill="white"
                opacity="0.9"
              />
              <circle cx="20" cy="14" r="2.5" fill="hsl(196 80% 38%)" />
            </svg>
          </div>
          <div>
            <h1 className="login-title">Clínica Admin</h1>
            <p className="login-subtitle">Sistema de administración dental</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="login-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={mode === "login"}
            id="tab-login"
            className={`login-tab ${mode === "login" ? "login-tab--active" : ""}`}
            onClick={() => { setMode("login"); setServerError(null); setSuccessMsg(null); }}
          >
            Iniciar sesión
          </button>
          <button
            role="tab"
            aria-selected={mode === "register"}
            id="tab-register"
            className={`login-tab ${mode === "register" ? "login-tab--active" : ""}`}
            onClick={() => { setMode("register"); setServerError(null); setSuccessMsg(null); }}
          >
            Crear cuenta
          </button>
        </div>

        {/* Mensaje de éxito */}
        {successMsg && (
          <div className="login-alert login-alert--success" role="alert">
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.707-9.293a1 1 0 0 0-1.414-1.414L9 10.586 7.707 9.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {successMsg}
          </div>
        )}

        {/* Error de servidor */}
        {serverError && (
          <div className="login-alert login-alert--error" role="alert">
            <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18" aria-hidden="true">
              <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0zm-7 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-1-9a1 1 0 0 0-1 1v4a1 1 0 1 0 2 0V6a1 1 0 0 0-1-1z" clipRule="evenodd" />
            </svg>
            {serverError}
          </div>
        )}

        {/* ── FORMULARIO LOGIN ─────────────────────────────────────────── */}
        {mode === "login" && (
          <form
            id="form-login"
            onSubmit={loginForm.handleSubmit(handleLogin)}
            className="login-form"
            noValidate
          >
            <div className="login-field">
              <label htmlFor="login-email" className="login-label">
                Correo electrónico
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                className={`login-input ${loginForm.formState.errors.email ? "login-input--error" : ""}`}
                placeholder="tu@correo.cl"
                {...loginForm.register("email")}
              />
              {loginForm.formState.errors.email && (
                <p className="login-error">{loginForm.formState.errors.email.message}</p>
              )}
            </div>

            <div className="login-field">
              <label htmlFor="login-password" className="login-label">
                Contraseña
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                className={`login-input ${loginForm.formState.errors.password ? "login-input--error" : ""}`}
                placeholder="••••••••"
                {...loginForm.register("password")}
              />
              {loginForm.formState.errors.password && (
                <p className="login-error">{loginForm.formState.errors.password.message}</p>
              )}
            </div>

            <button
              id="btn-login"
              type="submit"
              className="login-btn-primary"
              disabled={loading}
            >
              {loading ? (
                <span className="login-spinner" aria-label="Cargando" />
              ) : (
                "Ingresar"
              )}
            </button>
          </form>
        )}

        {/* ── FORMULARIO REGISTRO ──────────────────────────────────────── */}
        {mode === "register" && (
          <form
            id="form-register"
            onSubmit={registerForm.handleSubmit(handleRegister)}
            className="login-form"
            noValidate
          >
            <div className="login-field">
              <label htmlFor="reg-fullname" className="login-label">
                Nombre completo
              </label>
              <input
                id="reg-fullname"
                type="text"
                autoComplete="name"
                className={`login-input ${registerForm.formState.errors.fullName ? "login-input--error" : ""}`}
                placeholder="Dr. Juan Pérez"
                {...registerForm.register("fullName")}
              />
              {registerForm.formState.errors.fullName && (
                <p className="login-error">{registerForm.formState.errors.fullName.message}</p>
              )}
            </div>

            <div className="login-field">
              <label htmlFor="reg-clinicname" className="login-label">
                Nombre de la clínica
              </label>
              <input
                id="reg-clinicname"
                type="text"
                autoComplete="organization"
                className={`login-input ${registerForm.formState.errors.clinicName ? "login-input--error" : ""}`}
                placeholder="Clínica Dental del Norte"
                {...registerForm.register("clinicName")}
              />
              {registerForm.formState.errors.clinicName && (
                <p className="login-error">{registerForm.formState.errors.clinicName.message}</p>
              )}
            </div>

            <div className="login-field">
              <label htmlFor="reg-email" className="login-label">
                Correo electrónico
              </label>
              <input
                id="reg-email"
                type="email"
                autoComplete="email"
                className={`login-input ${registerForm.formState.errors.email ? "login-input--error" : ""}`}
                placeholder="tu@correo.cl"
                {...registerForm.register("email")}
              />
              {registerForm.formState.errors.email && (
                <p className="login-error">{registerForm.formState.errors.email.message}</p>
              )}
            </div>

            <div className="login-field">
              <label htmlFor="reg-password" className="login-label">
                Contraseña
              </label>
              <input
                id="reg-password"
                type="password"
                autoComplete="new-password"
                className={`login-input ${registerForm.formState.errors.password ? "login-input--error" : ""}`}
                placeholder="Mínimo 8 caracteres"
                {...registerForm.register("password")}
              />
              {registerForm.formState.errors.password && (
                <p className="login-error">{registerForm.formState.errors.password.message}</p>
              )}
            </div>

            <div className="login-field">
              <label htmlFor="reg-confirm" className="login-label">
                Confirmar contraseña
              </label>
              <input
                id="reg-confirm"
                type="password"
                autoComplete="new-password"
                className={`login-input ${registerForm.formState.errors.confirmPassword ? "login-input--error" : ""}`}
                placeholder="Repite tu contraseña"
                {...registerForm.register("confirmPassword")}
              />
              {registerForm.formState.errors.confirmPassword && (
                <p className="login-error">{registerForm.formState.errors.confirmPassword.message}</p>
              )}
            </div>

            <button
              id="btn-register"
              type="submit"
              className="login-btn-primary"
              disabled={loading}
            >
              {loading ? (
                <span className="login-spinner" aria-label="Cargando" />
              ) : (
                "Crear cuenta"
              )}
            </button>

            <p className="login-terms">
              Al crear una cuenta aceptas nuestros términos de uso y política de privacidad.
              Tus datos se protegen según la Ley 19.628.
            </p>
          </form>
        )}
      </div>

      {/* Estilos scoped */}
      <style>{`
        .login-page {
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          position: relative;
          overflow: hidden;
          background: hsl(210 20% 97%);
        }

        .login-bg {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 80% 60% at 20% 20%, hsl(196 80% 38% / 0.12) 0%, transparent 60%),
            radial-gradient(ellipse 60% 80% at 80% 80%, hsl(220 80% 55% / 0.08) 0%, transparent 60%),
            radial-gradient(ellipse 40% 40% at 60% 10%, hsl(196 80% 70% / 0.06) 0%, transparent 50%);
          animation: bgShift 8s ease-in-out infinite alternate;
        }

        @keyframes bgShift {
          from { opacity: 0.8; transform: scale(1); }
          to   { opacity: 1;   transform: scale(1.04); }
        }

        .login-card {
          position: relative;
          width: 100%;
          max-width: 420px;
          background: white;
          border-radius: 1.25rem;
          box-shadow:
            0 4px 6px -1px hsl(0 0% 0% / 0.05),
            0 20px 60px -10px hsl(196 80% 38% / 0.12),
            0 0 0 1px hsl(196 80% 38% / 0.06);
          padding: 2rem;
          animation: cardIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes cardIn {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .login-brand {
          display: flex;
          align-items: center;
          gap: 0.875rem;
          margin-bottom: 1.75rem;
        }

        .login-logo svg {
          width: 44px;
          height: 44px;
          filter: drop-shadow(0 4px 8px hsl(196 80% 38% / 0.3));
        }

        .login-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: hsl(222 47% 11%);
          line-height: 1.2;
          margin: 0;
        }

        .login-subtitle {
          font-size: 0.8rem;
          color: hsl(215 16% 47%);
          margin: 0;
        }

        .login-tabs {
          display: flex;
          gap: 0.25rem;
          background: hsl(210 40% 96%);
          border-radius: 0.625rem;
          padding: 0.25rem;
          margin-bottom: 1.5rem;
        }

        .login-tab {
          flex: 1;
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
          border: none;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          color: hsl(215 16% 47%);
          background: transparent;
        }

        .login-tab:hover:not(.login-tab--active) {
          color: hsl(222 47% 11%);
          background: hsl(0 0% 100% / 0.6);
        }

        .login-tab--active {
          background: white;
          color: hsl(196 80% 32%);
          font-weight: 600;
          box-shadow: 0 1px 3px hsl(0 0% 0% / 0.1);
        }

        .login-alert {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          border-radius: 0.625rem;
          font-size: 0.875rem;
          line-height: 1.4;
          margin-bottom: 1rem;
        }

        .login-alert svg { flex-shrink: 0; margin-top: 1px; }

        .login-alert--success {
          background: hsl(142 76% 36% / 0.08);
          color: hsl(142 76% 28%);
          border: 1px solid hsl(142 76% 36% / 0.2);
        }

        .login-alert--error {
          background: hsl(0 84% 60% / 0.08);
          color: hsl(0 72% 42%);
          border: 1px solid hsl(0 84% 60% / 0.2);
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .login-field {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }

        .login-label {
          font-size: 0.875rem;
          font-weight: 500;
          color: hsl(222 47% 20%);
        }

        .login-input {
          width: 100%;
          padding: 0.625rem 0.875rem;
          border: 1.5px solid hsl(214 32% 91%);
          border-radius: 0.5rem;
          font-size: 0.9375rem;
          color: hsl(222 47% 11%);
          background: hsl(210 40% 98%);
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
          outline: none;
          box-sizing: border-box;
        }

        .login-input::placeholder { color: hsl(215 16% 67%); }

        .login-input:focus {
          border-color: hsl(196 80% 38%);
          box-shadow: 0 0 0 3px hsl(196 80% 38% / 0.12);
          background: white;
        }

        .login-input--error {
          border-color: hsl(0 84% 60%);
        }

        .login-input--error:focus {
          border-color: hsl(0 84% 60%);
          box-shadow: 0 0 0 3px hsl(0 84% 60% / 0.12);
        }

        .login-error {
          font-size: 0.8125rem;
          color: hsl(0 72% 42%);
          margin: 0;
        }

        .login-btn-primary {
          width: 100%;
          padding: 0.75rem;
          background: hsl(196 80% 38%);
          color: white;
          font-size: 0.9375rem;
          font-weight: 600;
          border: none;
          border-radius: 0.625rem;
          cursor: pointer;
          transition: background 0.2s ease, transform 0.1s ease, box-shadow 0.2s ease;
          box-shadow: 0 4px 14px hsl(196 80% 38% / 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          margin-top: 0.25rem;
        }

        .login-btn-primary:hover:not(:disabled) {
          background: hsl(196 80% 32%);
          box-shadow: 0 6px 20px hsl(196 80% 38% / 0.45);
          transform: translateY(-1px);
        }

        .login-btn-primary:active:not(:disabled) {
          transform: translateY(0);
        }

        .login-btn-primary:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .login-spinner {
          width: 20px;
          height: 20px;
          border: 2.5px solid hsl(0 0% 100% / 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .login-terms {
          font-size: 0.75rem;
          color: hsl(215 16% 57%);
          text-align: center;
          line-height: 1.5;
          margin: 0;
        }
      `}</style>
    </div>
  );
}
