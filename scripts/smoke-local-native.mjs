/** Loopback-only Auth/REST/Storage smoke. Creates and removes one disposable local object. */
import { createClient } from "@supabase/supabase-js";
import { localConnectionEnv, nativeStatus } from "./lib/local-supabase.mjs";

const status = nativeStatus();
if (status.status !== 0 || JSON.parse(status.stdout).runtime !== "native") {
  throw new Error("A running native stack is required.");
}
const connection = localConnectionEnv();
if (connection.status !== 0) throw new Error("Could not inspect local credentials.");
const values = Object.fromEntries(
  connection.stdout.split("\n").map((line) => {
    const at = line.indexOf("=");
    return [line.slice(0, at), JSON.parse(line.slice(at + 1))];
  }),
);
if (
  values.API_URL !== "http://127.0.0.1:54321" ||
  values.DB_URL !== "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
) {
  throw new Error("Refusing smoke outside the fixed local native stack.");
}
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const user = createClient(values.API_URL, values.ANON_KEY, options);
const admin = createClient(values.API_URL, values.SERVICE_ROLE_KEY, options);
const signedIn = await user.auth.signInWithPassword({ email: "author1@local.test", password: "local-dev" });
if (signedIn.error) throw new Error(`Local Auth smoke failed: ${signedIn.error.code ?? "unknown"}`);
const courses = await admin.from("lms_courses").select("slug").eq("slug", "way21").single();
if (courses.error || courses.data?.slug !== "way21") throw new Error("Native REST did not return the restored course.");
const storage = admin.storage.from("course-media");
const object = `_local-smoke/native-${crypto.randomUUID()}.png`;
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
const uploaded = await storage.upload(object, png, { contentType: "image/png" });
if (uploaded.error) throw new Error(`Native Storage upload failed: ${uploaded.error.message}`);
try {
  const read = await storage.download(object);
  if (read.error || !read.data || read.data.size !== png.length) throw new Error("Native Storage read failed.");
} finally {
  const removed = await storage.remove([object]);
  if (removed.error) throw new Error("Could not remove the disposable local smoke object.");
  await user.auth.signOut({ scope: "local" });
}
console.log("PASS: native runtime, fictional author sign-in, restored course via REST, Storage upload/read/delete.");
