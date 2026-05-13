import type { Env } from '../../../_lib/types';
import { json, readJson } from '../../../_lib/http';
import { requireUser } from '../../../_lib/auth';
import { savePageDraft } from '../../../_lib/page-service';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const body = await readJson<any>(context.request);
  const page = await savePageDraft(context.env, String(context.params.id), body, user);
  return json({ page });
};
