import type { Env } from '../../_lib/types';
import { ok } from '../../_lib/http';
import { getPublicSettings } from '../../_lib/settings';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const settings = await getPublicSettings(context.env);
  return ok({ settings }, { headers: { 'cache-control': 'public, max-age=60, s-maxage=3600' } });
};
