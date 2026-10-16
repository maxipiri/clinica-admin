import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente Supabase para Client Components (corre en el browser).
 * Usar en componentes con "use client".
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
