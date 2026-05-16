import type { Env } from '../../_lib/types';
import { ok } from '../../_lib/http';

export const onRequestPost: PagesFunction<Env> = async () => {
  const cookie = [
    'wiki_token=',
    'Max-Age=0',
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax'
  ].join('; ');
  return ok({ success: true }, { headers: { 'Set-Cookie': cookie } });
};
