import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

type Toast = { id: number; type: 'success' | 'error'; message: string };

export default function ToastView({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed right-4 top-4 z-50 space-y-2">
      {toasts.map((t) => (
        <div key={t.id} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white shadow ${t.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          {t.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          {t.message}
        </div>
      ))}
    </div>
  );
}
