import type { Env } from '../../_lib/types';
import { json, error, readJson } from '../../_lib/http';
import { requireUser } from '../../_lib/auth';
import { createPage, listPages } from '../../_lib/page-service';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const pages = await listPages(context.env);
  return json({ pages });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const body = await readJson<{ title: string; slug?: string; summary?: string }>(context.request);
  if (!body.title) return error('Title is required', 400);
  const page = await createPage(context.env, body, user);
  return json({ page }, { status: 201 });
};
