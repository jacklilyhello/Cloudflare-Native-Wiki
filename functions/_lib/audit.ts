import type { AuthedUser, Env } from './types';
import { createId } from './id';

type AuditInput = {
  user?: AuthedUser | null;
  request?: Request;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

function getIpAddress(request?: Request) {
  return request?.headers.get('cf-connecting-ip') || request?.headers.get('x-forwarded-for') || null;
}

function getUserAgent(request?: Request) {
  return request?.headers.get('user-agent') || null;
}

export async function writeAuditLog(env: Env, input: AuditInput) {
  const siteId = env.SITE_ID || 'site_default';

  try {
    await env.DB.prepare(
      `INSERT INTO audit_logs (id, site_id, user_id, action, entity_type, entity_id, metadata_json, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      createId('audit'),
      siteId,
      input.user?.id || null,
      input.action,
      input.entityType,
      input.entityId || null,
      JSON.stringify(input.metadata || {}),
      getIpAddress(input.request),
      getUserAgent(input.request)
    ).run();
  } catch {
    // Audit logging must not break the primary user action.
  }
}
