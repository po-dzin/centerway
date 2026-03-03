import { createClient } from "@supabase/supabase-js";

/**
 * Browser-safe Supabase client (anon role).
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
if (!supabaseKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");

export const supabaseClient = createClient(supabaseUrl, supabaseKey);
