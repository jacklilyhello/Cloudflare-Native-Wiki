import type { Env } from '../../../_lib/types';
import { ok } from '../../../_lib/http';
import { requireUser } from '../../../_lib/auth';
import { createId } from '../../../_lib/id';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context); if (user instanceof Response) return user;
  const form = await context.request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return new Response('file required', { status: 400 });
  const id = createId('imp');
  const key = `imports/wikijs/tmp/${id}.tar.gz`;
  await context.env.ASSETS_BUCKET.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type || 'application/gzip' } });
  return ok({ uploadId: id, key, filename: file.name, size: file.size });
};
