import type { Env } from '../../_lib/types';
import { ok, readJson } from '../../_lib/http';
import { requireUser } from '../../_lib/auth';
import { renderMarkdown } from '../../_lib/markdown';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const body = await readJson<{ markdown: string }>(context.request);
  const rendered = renderMarkdown(body.markdown || '');
  return ok(rendered);
};
