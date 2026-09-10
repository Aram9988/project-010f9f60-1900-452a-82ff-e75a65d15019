from pathlib import Path

path = Path("src/v8/TeamTree.tsx")
text = path.read_text()

old_children = '''    {children.length > 0 && expanded && <div className="relative flex w-max min-w-full flex-col items-center">
      <TopologyConnectorFan childCount={children.length} activeFlags={childActiveFlags} depth={depth} />
      <div className="flex items-start justify-center gap-10 px-5">{children.map((child) => <div key={child.id} className="flex min-w-[300px] justify-center"><OrgNode user={child} state={state} items={items} visibleIds={visibleIds} onOpenItem={onOpenItem} callRequests={callRequests} currentUserId={currentUserId} onResolveCall={onResolveCall} branchHeadId={branchHeadId} depth={depth + 1} /></div>)}</div>
    </div>}'''

new_children = '''    {children.length > 0 && expanded && <div className="relative flex w-max min-w-full flex-col items-center">
      <TopologyConnectorFan childCount={children.length} activeFlags={childActiveFlags} depth={depth} />
      <div className="flex items-start justify-center gap-10 px-5">{children.map((child) => <div key={child.id} className="flex w-[300px] shrink-0 justify-center overflow-visible"><OrgNode user={child} state={state} items={items} visibleIds={visibleIds} onOpenItem={onOpenItem} callRequests={callRequests} currentUserId={currentUserId} onResolveCall={onResolveCall} branchHeadId={branchHeadId} depth={depth + 1} /></div>)}</div>
    </div>}'''

old_fan = '''function TopologyConnectorFan({ childCount, activeFlags, depth }: { childCount: number; activeFlags: boolean[]; depth: number }) {
  return <div className="relative h-20 w-full min-w-full">
    <svg aria-hidden="true" className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 80" preserveAspectRatio="none">
      <defs><filter id={`topology-glow-${depth}-${childCount}`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
      {Array.from({ length: childCount }).map((_, index) => {
        const x = ((childCount - index - 0.5) / childCount) * 100;
        const d = childCount === 1 ? "M50 0 V80" : `M50 0 V28 H${x} V80`;
        const active = !!activeFlags[index];
        return <g key={index}>
          <path d={d} fill="none" stroke={active ? "rgba(103,232,249,.34)" : "rgba(103,232,249,.16)"} strokeWidth={active ? 1.55 : 1.1} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
          {active && <>
            <path d={d} fill="none" stroke="rgba(103,232,249,.98)" strokeWidth="2.4" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 30" filter={`url(#topology-glow-${depth}-${childCount})`}>
              <animate attributeName="stroke-dashoffset" from="0" to="-128" dur="4.8s" begin={`${index * 0.22}s`} repeatCount="indefinite" />
            </path>
            <path d={d} fill="none" stroke="rgba(52,211,153,.7)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 44">
              <animate attributeName="stroke-dashoffset" from="-18" to="-146" dur="4.8s" begin={`${index * 0.22}s`} repeatCount="indefinite" />
            </path>
          </>}
        </g>;
      })}
    </svg>
  </div>;
}'''

new_fan = '''function TopologyConnectorFan({ childCount, activeFlags, depth }: { childCount: number; activeFlags: boolean[]; depth: number }) {
  const columnWidth = 300;
  const gap = 40;
  const sidePadding = 20;
  const totalWidth = Math.max(columnWidth + sidePadding * 2, childCount * columnWidth + Math.max(0, childCount - 1) * gap + sidePadding * 2);
  const startX = totalWidth / 2;

  return <div className="relative h-24 w-full min-w-full">
    <svg aria-hidden="true" className="absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${totalWidth} 96`} preserveAspectRatio="none">
      <defs><filter id={`topology-glow-${depth}-${childCount}`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
      {Array.from({ length: childCount }).map((_, index) => {
        const visualIndex = childCount - 1 - index;
        const endX = sidePadding + columnWidth / 2 + visualIndex * (columnWidth + gap);
        const bendY = childCount === 1 ? 48 : 40 + Math.min(18, Math.abs(endX - startX) / 18);
        const d = childCount === 1
          ? `M${startX} 0 C${startX - 18} 28 ${startX + 18} 64 ${endX} 96`
          : `M${startX} 0 C${startX} 30 ${endX} ${bendY} ${endX} 96`;
        const active = !!activeFlags[index];
        return <g key={index}>
          <path d={d} fill="none" stroke={active ? "rgba(103,232,249,.34)" : "rgba(103,232,249,.16)"} strokeWidth={active ? 1.55 : 1.1} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
          {active && <>
            <path d={d} fill="none" stroke="rgba(103,232,249,.98)" strokeWidth="2.4" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeDasharray="2 30" filter={`url(#topology-glow-${depth}-${childCount})`}>
              <animate attributeName="stroke-dashoffset" from="0" to="-128" dur="4.8s" begin={`${index * 0.22}s`} repeatCount="indefinite" />
            </path>
            <path d={d} fill="none" stroke="rgba(52,211,153,.7)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeDasharray="1 44">
              <animate attributeName="stroke-dashoffset" from="-18" to="-146" dur="4.8s" begin={`${index * 0.22}s`} repeatCount="indefinite" />
            </path>
          </>}
        </g>;
      })}
    </svg>
  </div>;
}'''

if old_children not in text:
    raise SystemExit("current child layout block not found")
if old_fan not in text:
    raise SystemExit("current connector fan block not found")

text = text.replace(old_children, new_children, 1)
text = text.replace(old_fan, new_fan, 1)
path.write_text(text)
