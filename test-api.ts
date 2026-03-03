import { createClient } from "@supabase/supabase-js";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const sb = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false }});
async function go() {
    // wait for auth? We need a valid session to test. We can't easily get one via script without logging in.
    console.log("Not easy to generate token in script.");
}
go();
