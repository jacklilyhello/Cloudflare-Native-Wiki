import type { Env } from '../../../_lib/types';
import { ok } from '../../../_lib/http';
import { requireUser } from '../../../_lib/auth';

const REQUIRED_TABLES = ['pages','page_versions','assets','navigation','audit_logs','settings','import_jobs','slug_redirects'];
const REQUIRED_COLUMNS: Record<string,string[]> = {
  pages: ['id','site_id','title','slug','normalized_slug','status','current_version_id','content_r2_key','rendered_r2_key','deleted_at','deleted_by','created_at','updated_at'],
  page_versions: ['id','page_id','version_number','status','content_r2_key','rendered_r2_key','created_at']
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context); if (user instanceof Response) return user;
  const tables = await context.env.DB.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all<any>();
  const existing = new Set((tables.results || []).map((r:any) => r.name));
  const missingTables = REQUIRED_TABLES.filter((t) => !existing.has(t));
  const missingColumns: Record<string, string[]> = {};
  for (const [table, cols] of Object.entries(REQUIRED_COLUMNS)) {
    if (!existing.has(table)) { missingColumns[table] = cols; continue; }
    const pragma = await context.env.DB.prepare(`PRAGMA table_info(${table})`).all<any>();
    const have = new Set((pragma.results || []).map((c:any) => c.name));
    const miss = cols.filter((c) => !have.has(c));
    if (miss.length) missingColumns[table] = miss;
  }
  return ok({ schemaOk: missingTables.length === 0 && Object.keys(missingColumns).length === 0, missingTables, missingColumns });
};
