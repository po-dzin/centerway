import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { adminClient } from "./adminClient";

export async function requireAdmin(req: NextRequest) {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
        console.error("requireAdmin: No auth header");
        return null;
    }
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false } }
    );

    const { data: { user }, error: sessionError } = await supabase.auth.getUser(token);
    if (!user) {
        console.error("requireAdmin: Invalid token", sessionError);
        return null;
    }

    const db = adminClient();
    const { data, error: roleError } = await db.from("user_roles").select("role").eq("user_id", user.id).single();

    if (roleError) {
        console.error("requireAdmin: Role fetch error", roleError);
        return null;
    }
    if (!data || !["admin", "support", "Admin", "Support"].includes(data.role)) {
        console.error("requireAdmin: Invalid role or missing data", data);
        return null;
    }
    return { user };
}
