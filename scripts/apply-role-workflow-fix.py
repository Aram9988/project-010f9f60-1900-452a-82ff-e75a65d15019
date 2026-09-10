from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing replacement: {label}")
    return text.replace(old, new, 1)


app_path = Path("src/v8/App.tsx")
app = app_path.read_text()
app = replace_once(
    app,
    '    const ownerId = department?.headUserId || (assignee && !departmentId ? currentUser.id : currentUser.id);',
    '    const ownerId = department?.headUserId || assignee?.managerId || currentUser.id;',
    'direct-assignment owner',
)
app = replace_once(
    app,
    '''    const branchHead = org.users.find((u) => roleOf(org, u)?.key === "branch_head");
    const recipients = new Set<string>();
    [item.issuedById, item.ownerId, item.assigneeId, branchHead?.id].forEach((id) => { if (id && id !== currentUser.id) recipients.add(id); });
    const message = status === "active" ? `تم استلام وبدء تنفيذ: ${item.title}` : status === "review" ? `تم إرسال العمل للاعتماد: ${item.title}` : status === "done" ? `تم إنهاء واعتماد: ${item.title}` : status === "returned" ? `أعيد العمل للتعديل: ${item.title}` : `تحديث على: ${item.title}`;
    recipients.forEach((id) => notify(id, message, item.id));''',
    '''    const branchHead = org.users.find((u) => roleOf(org, u)?.key === "branch_head" || roleOf(org, u)?.name?.trim() === "رئيس الفرع");
    const recipients = new Set<string>();
    if (status === "review") {
      const submitterManager = currentUser.managerId ? org.users.find((u) => u.id === currentUser.managerId && u.active) : undefined;
      const departmentHeadId = item.departmentId ? org.departments.find((d) => d.id === item.departmentId)?.headUserId : undefined;
      const approvalTargetId = submitterManager?.id || departmentHeadId || branchHead?.id;
      if (approvalTargetId && approvalTargetId !== currentUser.id) recipients.add(approvalTargetId);
    } else {
      [item.issuedById, item.ownerId, item.assigneeId, branchHead?.id].forEach((id) => { if (id && id !== currentUser.id) recipients.add(id); });
    }
    const message = status === "active" ? `تم استلام وبدء تنفيذ: ${item.title}` : status === "review" ? `تم إنجاز العمل وإرساله للموافقة: ${item.title}` : status === "done" ? `تمت الموافقة على الإنجاز وإغلاق العمل: ${item.title}` : status === "returned" ? `أعيد العمل للتعديل: ${item.title}` : `تحديث على: ${item.title}`;
    recipients.forEach((id) => notify(id, message, item.id));''',
    'approval notification routing',
)
app_path.write_text(app)

wd_path = Path("src/v8/WorkDetail.tsx")
wd = wd_path.read_text()
wd = replace_once(
    wd,
    '''  const isBranch = currentRole?.key === "branch_head";
  const isDept = currentRole?.key === "department_head";
  const isOffice = currentRole?.key === "office_responsible";''',
    '''  const isBranch = currentRole?.key === "branch_head" || currentRole?.name?.trim() === "رئيس الفرع";
  const isDept = currentRole?.key === "department_head" || currentRole?.name?.includes("رئيس قسم") === true;
  const isOffice = currentRole?.key === "office_responsible" || currentRole?.name?.includes("مسؤول مكتب") === true;''',
    'role matching',
)
wd = replace_once(
    wd,
    '''  const assignee = org.users.find((u) => u.id === item.assigneeId);
  const owner = org.users.find((u) => u.id === item.ownerId);
  const dept = org.departments.find((d) => d.id === item.departmentId);''',
    '''  const assignee = org.users.find((u) => u.id === item.assigneeId);
  const owner = org.users.find((u) => u.id === item.ownerId);
  const dept = org.departments.find((d) => d.id === item.departmentId);
  const branch = org.users.find((u) => roleOf(org, u)?.key === "branch_head" || roleOf(org, u)?.name?.trim() === "رئيس الفرع");
  const deptHead = dept?.headUserId ? org.users.find((u) => u.id === dept.headUserId) : undefined;
  const assigneeRole = assignee ? roleOf(org, assignee) : undefined;
  const assigneeIsBranch = assigneeRole?.key === "branch_head" || assigneeRole?.name?.trim() === "رئيس الفرع";
  const configuredManager = assignee?.managerId ? org.users.find((u) => u.id === assignee.managerId && u.active) : undefined;
  const approvalTarget = assigneeIsBranch ? undefined : configuredManager ?? deptHead ?? branch;
  const approvalTargetId = approvalTarget?.id;''',
    'approval target',
)
wd = replace_once(
    wd,
    '''  const officeCanComplete = !isProject && isOffice && assignedToMe && canWork && ["active", "waiting"].includes(item.status);
  const canApprove = !readOnlyProject && (isBranch || (!isProject && isDept && item.departmentId === currentUser.departmentId));
  const canLifecycle = isBranch || (!isProject && isDept && item.departmentId === currentUser.departmentId);
  const canReopen = canLifecycle && !item.archivedAt && item.status === "done";

  const branch = org.users.find((u) => roleOf(org, u)?.key === "branch_head");
  const deptHead = dept?.headUserId ? org.users.find((u) => u.id === dept.headUserId) : undefined;''',
    '''  const canSubmitCompletion = assignedToMe && canWork && ["active", "waiting"].includes(item.status) && !!approvalTargetId && approvalTargetId !== currentUser.id;
  const canCloseOwn = assignedToMe && canWork && ["active", "waiting"].includes(item.status) && !approvalTargetId;
  const canApprove = !readOnlyProject && item.status === "review" && (approvalTargetId === currentUser.id || (!approvalTargetId && isBranch));
  const canLifecycle = isBranch || (!isProject && isDept && item.departmentId === currentUser.departmentId);
  const canReopen = canLifecycle && !item.archivedAt && item.status === "done";''',
    'approval policy',
)
wd = replace_once(
    wd,
    '          {isOffice && !isProject && <Notice tone="emerald">عند إنهاء المهمة اضغط «تم الإنجاز». سيصل إشعار إلى رئيس القسم، ولا يظهر لمسؤول المكتب زر «إرسال للاعتماد».</Notice>}',
    '          {isOffice && !isProject && <Notice tone="emerald">عند إنهاء المهمة اضغط «تم الإنجاز». ستنتقل المهمة إلى بانتظار الموافقة عند رئيس القسم، ولن تصبح منجزة إلا بعد اعتماده لها.</Notice>}\n          {item.status === "review" && approvalTarget && <Notice tone="indigo">تم إنجاز العمل من المنفذ وهو الآن بانتظار موافقة {approvalTarget.name}. لا يعتبر العمل منجزاً نهائياً قبل الاعتماد.</Notice>}',
    'office notice',
)
wd = replace_once(
    wd,
    '''          {canWork && !isOffice && ["active", "waiting"].includes(item.status) && <Primary onClick={() => onTransition(item, "review", `تم إرسال ${noun} للاعتماد.`)}>إرسال للاعتماد</Primary>}
          {officeCanComplete && <Primary onClick={() => onTransition(item, "done", "تم إنجاز المهمة من قبل مسؤول المكتب وإبلاغ رئيس القسم.")}><CheckCircle2 size={14} />تم الإنجاز</Primary>}
          {canApprove && !item.archivedAt && !["done", "new", "returned"].includes(item.status) && <Primary onClick={() => onTransition(item, "done", `تم اعتماد ${noun} وإنهاؤه.`)}><CheckCircle2 size={14} />اعتماد وإنهاء</Primary>}
          {canApprove && !item.archivedAt && item.status === "review" && <button onClick={() => onTransition(item, "returned", `أعيد ${noun} للتعديل وبانتظار تأكيد الاستلام من المسؤول.`)} className="h-10 rounded-xl border border-rose-400/15 bg-rose-400/5 px-3 text-[11px] font-bold text-rose-300">إعادة للتعديل</button>}''',
    '''          {canSubmitCompletion && <Primary onClick={() => onTransition(item, "review", `تم إنجاز ${noun} وإرساله إلى ${approvalTarget?.name ?? "المسؤول الأعلى"} للموافقة.`)}><CheckCircle2 size={14} />تم الإنجاز</Primary>}
          {canCloseOwn && <Primary onClick={() => onTransition(item, "done", `تم إنهاء ${noun} واعتماده.`)}><CheckCircle2 size={14} />إنهاء واعتماد</Primary>}
          {canApprove && !item.archivedAt && <Primary onClick={() => onTransition(item, "done", `تمت الموافقة على إنجاز ${noun} وإغلاقه كمنجز.`)}><CheckCircle2 size={14} />موافقة وإغلاق كمنجز</Primary>}
          {canApprove && !item.archivedAt && <button onClick={() => onTransition(item, "returned", `أعيد ${noun} للتعديل وبانتظار تأكيد الاستلام من المسؤول.`)} className="h-10 rounded-xl border border-rose-400/15 bg-rose-400/5 px-3 text-[11px] font-bold text-rose-300">إعادة للتعديل</button>}''',
    'workflow buttons',
)
wd_path.write_text(wd)

tree_path = Path("src/v8/TeamTree.tsx")
tree = tree_path.read_text()
tree = replace_once(
    tree,
    '        <div className="text-[10px] text-slate-600">الخطوط منحنية كمسارات شبكة حقيقية، والموجة تظهر فقط على الطريق المؤدي إلى عمل نشط. في ملء الشاشة استخدم عجلة الماوس للتكبير والتصغير واسحب لتحريك المخطط.</div>',
    '        <div className="text-[10px] text-slate-600">خطوط تنظيمية واضحة بدون تقاطعات؛ كل موظف يتصل مباشرة بمسؤوله، وتظهر حركة الإشارة فقط على المسار المؤدي إلى عمل نشط. في ملء الشاشة استخدم عجلة الماوس للتكبير والتصغير واسحب لتحريك المخطط.</div>',
    'topology helper text',
)
tree = replace_once(
    tree,
    '''function CurvedStem() {
  return <svg aria-hidden="true" className="h-14 w-28 overflow-visible" viewBox="0 0 100 56"><path d="M50 0 C35 16 65 36 50 56" fill="none" stroke="rgba(103,232,249,.24)" strokeWidth="1.4" strokeLinecap="round" /></svg>;
}''',
    '''function CurvedStem() {
  return <svg aria-hidden="true" className="h-14 w-28 overflow-visible" viewBox="0 0 100 56"><path d="M50 0 V56" fill="none" stroke="rgba(103,232,249,.24)" strokeWidth="1.4" strokeLinecap="round" /></svg>;
}''',
    'root connector',
)
tree = replace_once(
    tree,
    '''function TopologyConnectorFan({ childCount, activeFlags, depth }: { childCount: number; activeFlags: boolean[]; depth: number }) {
  return <div className="relative h-20 w-full min-w-full">
    <svg aria-hidden="true" className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 80" preserveAspectRatio="none">
      <defs><filter id={`topology-glow-${depth}-${childCount}`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
      {Array.from({ length: childCount }).map((_, index) => {
        const x = ((childCount - index - 0.5) / childCount) * 100;
        const d = childCount === 1 ? "M50 0 C38 20 62 52 50 80" : `M50 0 C50 28 ${x} 26 ${x} 80`;
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
}''',
    '''function TopologyConnectorFan({ childCount, activeFlags, depth }: { childCount: number; activeFlags: boolean[]; depth: number }) {
  const targets = Array.from({ length: childCount }, (_, index) => ((childCount - index - 0.5) / childCount) * 100);
  const left = Math.min(...targets);
  const right = Math.max(...targets);
  const railY = 30;
  const radius = 3;

  function routeTo(x: number) {
    if (childCount === 1) return "M50 0 V80";
    if (x < 50) return `M50 0 V${railY - radius} Q50 ${railY} ${50 - radius} ${railY} H${x + radius} Q${x} ${railY} ${x} ${railY + radius} V80`;
    return `M50 0 V${railY - radius} Q50 ${railY} ${50 + radius} ${railY} H${x - radius} Q${x} ${railY} ${x} ${railY + radius} V80`;
  }

  return <div className="relative h-20 w-full min-w-full">
    <svg aria-hidden="true" className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 80" preserveAspectRatio="none">
      <defs><filter id={`topology-glow-${depth}-${childCount}`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
      <path d={childCount === 1 ? "M50 0 V80" : `M50 0 V${railY} M${left} ${railY} H${right}`} fill="none" stroke="rgba(103,232,249,.18)" strokeWidth="1.1" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
      {targets.map((x, index) => <path key={`drop-${index}`} d={childCount === 1 ? "" : `M${x} ${railY} V80`} fill="none" stroke="rgba(103,232,249,.18)" strokeWidth="1.1" vectorEffect="non-scaling-stroke" strokeLinecap="round" />)}
      {targets.map((x, index) => {
        if (!activeFlags[index]) return null;
        const d = routeTo(x);
        return <g key={`active-${index}`}>
          <path d={d} fill="none" stroke="rgba(103,232,249,.98)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 30" filter={`url(#topology-glow-${depth}-${childCount})`}>
            <animate attributeName="stroke-dashoffset" from="0" to="-128" dur="4.8s" begin={`${index * 0.18}s`} repeatCount="indefinite" />
          </path>
          <path d={d} fill="none" stroke="rgba(52,211,153,.68)" strokeWidth="1.1" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 44">
            <animate attributeName="stroke-dashoffset" from="-18" to="-146" dur="4.8s" begin={`${index * 0.18}s`} repeatCount="indefinite" />
          </path>
        </g>;
      })}
    </svg>
  </div>;
}''',
    'clean topology fan',
)
tree_path.write_text(tree)
