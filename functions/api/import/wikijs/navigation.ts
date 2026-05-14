import type { Env } from '../../../_lib/types';
import { ok, readJson } from '../../../_lib/http';
import { requireUser } from '../../../_lib/auth';
import { replaceNavigationTree } from '../../../_lib/navigation';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const body = await readJson<{ tree: any[] }>(context.request);
  const tree = await replaceNavigationTree(context.env, body.tree || []);
  return ok({ imported: tree.length });
};
