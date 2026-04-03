import { createClient } from "@supabase/supabase-js";

export async function requireUserFromBearer(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length);
  if (!token) return null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) return null;
  return user;
}
