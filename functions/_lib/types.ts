export type Env = {
  DB: D1Database;
  WIKI_KV: KVNamespace;
  ASSETS_BUCKET: R2Bucket;
  SITE_ID: string;
  SITE_URL: string;
  JWT_ISSUER: string;
  JWT_SECRET: string;
  ADMIN_EMAIL: string;
  ADMIN_PASSWORD_HASH?: string;
  ADMIN_DEV_PASSWORD?: string;
};

export type AuthedUser = {
  id: string;
  email: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
};

export type NavNode = {
  id: string;
  parent_id?: string | null;
  page_id?: string | null;
  label: string;
  icon?: string | null;
  href?: string | null;
  sort_order?: number;
  depth?: number;
  is_folder?: number | boolean;
  is_visible?: number | boolean;
  children?: NavNode[];
};
