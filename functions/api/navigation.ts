import type { Env } from '../_lib/types';
import { json, readJson } from '../_lib/http';
import { requireUser } from '../_lib/auth';
import { getNavigationTree, replaceNavigationTree } from '../_lib/navigation';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const tree = await getNavigationTree(context.env);
  return json({ tree });
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const body = await readJson<any>(context.request);
  const tree = await replaceNavigationTree(context.env, body.tree || []);
  return json({ tree });
};
