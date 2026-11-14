import fs from 'fs';
import path from 'path';

const root = path.resolve('supabase/migrations');
const names = ['is_assigned_designer', 'has_project_share_access'];
let touched = 0;
for (const file of fs.readdirSync(root).filter((entry) => entry.endsWith('.sql'))) {
  const fullPath = path.join(root, file);
  let sql = fs.readFileSync(fullPath, 'utf8');
  const original = sql;
  for (const name of names) {
    const pattern = new RegExp(`CREATE OR REPLACE FUNCTION (?:public\\.)?${name}\\s*\\(`, 'g');
    sql = sql.replace(pattern, (match, offset) => {
      const prior = sql.slice(Math.max(0, offset - 120), offset);
      if (prior.includes(`DROP FUNCTION IF EXISTS ${name}(uuid)`)) return match;
      return `DROP FUNCTION IF EXISTS ${name}(uuid);\n${match}`;
    });
  }
  if (sql !== original) {
    fs.writeFileSync(fullPath, sql);
    touched += 1;
  }
}
console.log(JSON.stringify({ touched }));
