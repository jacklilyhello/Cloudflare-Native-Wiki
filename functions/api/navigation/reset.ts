import type { Env } from '../../_lib/types';
import { json } from '../../_lib/http';
import { requireUser } from '../../_lib/auth';
import { resetNavigationTree } from '../../_lib/navigation';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const tree = await resetNavigationTree(context.env);
  return json({ tree });
};
