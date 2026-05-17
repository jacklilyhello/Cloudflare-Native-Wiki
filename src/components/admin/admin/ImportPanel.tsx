import React, { useState } from 'react';
import { api } from './api';
import LoadingButton from './LoadingButton';
import type { ToastPush } from './types';

type Stage = 'upload' | 'dryrun' | 'confirm';

export default function ImportPanel({ push }: { push: ToastPush }) {
  const [stage, setStage] = useState<Stage>('upload');
  const [upload, setUpload] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  async function onUpload(file: File) {
    setLoading(true);
    try {
      const form = new FormData(); form.append('file', file);
      const res = await api('/api/import/wikijs/upload', { method: 'POST', body: form });
      setUpload(res); setStage('dryrun'); setProgress(30);
      push('success', `上传完成: ${res.filename}`);
    } catch (e: any) { push('error', e.message); } finally { setLoading(false); }
  }

  async function doDryRun() {
    if (!upload?.key) return;
    setLoading(true);
    try {
      const res = await api('/api/import/wikijs/dry-run', { method: 'POST', body: JSON.stringify({ key: upload.key }) });
      setPreview(res); setStage('confirm'); setProgress(65);
    } catch (e: any) { push('error', e.message); } finally { setLoading(false); }
  }

  async function confirmImport() {
    if (!upload?.key) return;
    setLoading(true);
    try {
      const res = await api('/api/import/wikijs/confirm-import', { method: 'POST', body: JSON.stringify({ key: upload.key }) });
      setReport(res); setProgress(100); push('success', `导入完成 job=${res.jobId}`);
    } catch (e: any) { push('error', e.message); } finally { setLoading(false); }
  }

  return <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
    <h2 className="text-lg font-semibold">Wiki.js Import</h2>
    <p className="mt-1 text-sm text-[var(--muted)]">三段式：上传 → dry-run 预览 → 确认导入</p>
    <div className="mt-2 h-2 rounded bg-slate-200"><div className="h-2 rounded bg-blue-500" style={{ width: `${progress}%` }} /></div>

    {stage === 'upload' && <div className="mt-4">
      <label className="flex min-h-24 cursor-pointer items-center justify-center rounded-xl border border-dashed p-4">上传 wikijs-web-export-*.tar.gz
        <input type="file" className="hidden" accept=".tar.gz,.tgz" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
      </label>
    </div>}

    {stage === 'dryrun' && <div className="mt-4 space-y-3 text-sm">
      <div>已上传：{upload?.filename} ({upload?.size} bytes)</div>
      <LoadingButton loading={loading} onClick={doDryRun} className="rounded-xl bg-[var(--primary)] px-4 py-2 text-white">执行 dry-run 解析</LoadingButton>
    </div>}

    {stage === 'confirm' && <div className="mt-4 space-y-3 text-sm">
      <div>pages: {preview?.pages?.length || 0} / assets: {preview?.metadata?.assetCount || 0} / history: {preview?.metadata?.historyCount || 0}</div>
      <div>errors: {(preview?.errors || []).length}</div>
      <div className="max-h-40 overflow-auto rounded border p-2 text-xs">{(preview?.pages || []).slice(0, 20).map((p: any, idx: number) => <div key={idx}>{p.path} - {p.title}</div>)}</div>
      <LoadingButton loading={loading} onClick={confirmImport} className="rounded-xl bg-emerald-600 px-4 py-2 text-white">确认导入</LoadingButton>
    </div>}

    {report?.stats && <div className="mt-4 rounded border p-3 text-xs space-y-1">
      <div>总文件: {report.stats.totalFiles}</div>
      <div>页面 成功/跳过/失败: {report.stats.pages.success}/{report.stats.pages.skipped}/{report.stats.pages.failed}</div>
      <div>失败原因: {JSON.stringify(report.stats.failureReasons)}</div>
      <div>导航/缓存刷新: {report.stats.refreshed.navigation ? 'yes' : 'no'} / {report.stats.refreshed.cache ? 'yes' : 'no'}</div>
    </div>}
  </section>;
}
