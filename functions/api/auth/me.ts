import type { Env } from '../../_lib/types';
import { ok } from '../../_lib/http';
import { requireUser } from '../../_lib/auth';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  return ok({ user });
};
