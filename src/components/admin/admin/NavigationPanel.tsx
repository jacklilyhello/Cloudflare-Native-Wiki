import React, { useEffect, useMemo, useState } from 'react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api, LoadingButton, NetworkError, Panel } from './shared';
import type { PushToast } from './shared';

type Node = { id: string; title: string; type: 'page'|'external'|'section'; icon?: string; hidden?: boolean; children?: Node[] };
const flatten = (tree: Node[]) => tree;

function Row({ node, onToggle }: { node: Node; onToggle: (id:string)=>void }) {
  const {attributes, listeners, setNodeRef, transform, transition} = useSortable({id: node.id});
  return <div ref={setNodeRef} style={{transform: CSS.Transform.toString(transform), transition}} className='mb-2 flex items-center justify-between rounded border p-2'>
    <div className='flex items-center gap-2' {...attributes} {...listeners}><span className='text-xs rounded bg-slate-100 px-2'>{node.type}</span><span>{node.icon || '📄'}</span><span>{node.title}</span></div>
    <button className='text-xs underline' onClick={()=>onToggle(node.id)}>{node.hidden ? '显示':'隐藏'}</button>
  </div>;
}

export default function NavigationPanel({ push }: { push: PushToast }) {
  const [tree, setTree] = useState<Node[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const ids = useMemo(()=>flatten(tree).map(n=>n.id), [tree]);
  const load = async()=>{ try { setError(''); const [nav,pages] = await Promise.all([api('/api/navigation'), api('/api/pages')]); const next = (nav.tree?.length ? nav.tree : (pages.pages||[]).map((p:any)=>({id:p.id,title:p.title,type:'page',hidden:false}))) as Node[]; setTree(next); push('success', '导航加载成功'); } catch(e:any){ setError(e.message); push('error', e.message);} };
  useEffect(()=>{ load(); },[]);
  const onDragEnd = (e:any)=>{ const {active, over} = e; if (!over || active.id===over.id) return; const oldIndex = ids.indexOf(active.id); const newIndex = ids.indexOf(over.id); setTree(arrayMove(tree, oldIndex, newIndex)); };
  return <Panel title='导航树管理' desc='可视化拖拽排序（当前为顶层排序）。'><div className='mb-3 text-xs text-[var(--muted)]'>支持节点类型、图标、显示开关。可从页面自动生成初始树。</div>{error && <NetworkError message={error} onRetry={load} />} {!tree.length && !error ? <div className='space-y-2'>{[1,2,3].map(i=><div key={i} className='h-10 animate-pulse rounded bg-slate-100'/>)}</div> : <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}><SortableContext items={ids} strategy={verticalListSortingStrategy}>{tree.map((node)=> <Row key={node.id} node={node} onToggle={(id)=>setTree((s)=>s.map(n=>n.id===id?{...n, hidden:!n.hidden}:n))} />)}</SortableContext></DndContext>}
  <div className='mt-3'><LoadingButton loading={loading} onClick={async()=>{ if (loading) return; try { setLoading(true); await api('/api/navigation',{method:'PUT',body:JSON.stringify({tree})}); push('success','导航已保存'); } catch(e:any){ push('error',`导航保存失败: ${e.message}`);} finally {setLoading(false);} }} className='rounded-xl bg-[var(--primary)] px-4 py-2 text-sm text-white'>保存导航</LoadingButton></div></Panel>;
}
