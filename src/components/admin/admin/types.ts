export type PageItem = { id: string; title: string; slug: string; status: string; summary?: string; content?: string; meta_title?: string; meta_description?: string };
export type SettingsMap = Record<string, string>;
export type ToastPush = (t: 'success' | 'error', m: string) => void;
