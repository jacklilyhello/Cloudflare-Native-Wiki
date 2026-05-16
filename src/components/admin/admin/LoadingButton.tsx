import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingButton({ loading, children, ...props }: any) {
  return <button disabled={loading || props.disabled} {...props} className={`${props.className} disabled:opacity-50`}>
    {loading && <Loader2 size={15} className="mr-2 inline animate-spin" />}
    {children}
  </button>;
}
