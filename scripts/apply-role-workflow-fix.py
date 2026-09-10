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
app = replace_once(
    app,
    '''function assignableUsers(org: OrgState, currentUser: OrgUser) {
  if (hasPermission(org, currentUser, "assign_department_tasks")) return org.users.filter((u) => u.active && roleOf(org, u)?.key !== "branch_head");''',
    '''function assignableUsers(org: OrgState, currentUser: OrgUser) {
  const currentRole = roleOf(org, currentUser);
  if (currentRole?.key === "branch_head" || currentRole?.name?.trim() === "رئيس الفرع") return org.users.filter((u) => u.active && u.managerId === currentUser.id);
  if (hasPermission(org, currentUser, "assign_department_tasks")) return org.users.filter((u) => u.active && roleOf(org, u)?.key !== "branch_head");''',
    'branch-head direct reports',
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
