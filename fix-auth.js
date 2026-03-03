const fs = require('fs');

const files = [
  'src/app/api/admin/orders/route.ts',
  'src/app/api/admin/customers/route.ts',
  'src/app/api/admin/customers/[id]/route.ts'
];

for (let file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(
    /const \{ data, error: roleError \} = await supabase\s*\n\s*\.from\("user_roles"\)\.select\("role"\)\.eq\("user_id", user\.id\)\.single\(\);|const \{ data \} = await supabase\s*\n\s*\.from\("user_roles"\)\.select\("role"\)\.eq\("user_id", user\.id\)\.single\(\);/gs,
    `const db = adminClient();
  const { data, error: roleError } = await db.from("user_roles").select("role").eq("user_id", user.id).single();`
  );
  fs.writeFileSync(file, content);
}
