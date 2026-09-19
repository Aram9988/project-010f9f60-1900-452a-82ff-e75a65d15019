import { useMemo, useState } from "react";
import { CalendarDays, CarFront, Check, CircleX, Fuel, Pencil, Plus, Trash2, Wrench } from "lucide-react";
import type { AppState, FleetVehicle, FleetVehicleStatus, MaintenanceRequestStatus, VehicleMaintenanceRequest, VehicleNeedLine, VehicleNeedRequest, VehicleNeedStatus } from "../v2/model";
import { SYSTEM_ADMIN_ID, roleOf, type OrgState, type OrgUser } from "./orgModel";

const nowIso = () => new Date().toISOString();
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); };

const vehicleStatusMeta: Record<FleetVehicleStatus, { label: string; tone: string }> = {
  available: { label: "متاحة", tone: "text-emerald-300" },
  assigned: { label: "مخصصة", tone: "text-amber-300" },
  maintenance: { label: "في الصيانة", tone: "text-rose-300" },
  out_of_service: { label: "خارج الخدمة", tone: "text-slate-400" },
};

const maintenanceStatusMeta: Record<MaintenanceRequestStatus, string> = {
  requested: "طلب جديد",
  scheduled: "تم تحديد الموعد",
  in_maintenance: "في الصيانة",
  completed: "مكتمل",
  rejected: "مرفوض",
};

const needStatusMeta: Record<VehicleNeedStatus, string> = {
  requested: "بانتظار الرد",
  approved: "موافق عليه",
  partial: "موافقة جزئية",
  rejected: "مرفوض",
  completed: "مكتمل",
};

type Props = {
  org: OrgState;
  app: AppState;
  setApp: React.Dispatch<React.SetStateAction<AppState>>;
  currentUser: OrgUser;
  onNotify: (userId: string, text: string) => void;
};

type FleetSection = "vehicles" | "maintenance" | "requests";

function vehicleLabel(vehicle?: FleetVehicle) {
  return vehicle ? [vehicle.make, vehicle.model, vehicle.plateNumber].filter(Boolean).join(" — ") : "مركبة غير معروفة";
}

export default function FleetManagement({ org, app, setApp, currentUser, onNotify }: Props) {
  const role = roleOf(org, currentUser);
  const isAdmin = currentUser.id === SYSTEM_ADMIN_ID;
  const isVehicles = role?.key === "vehicles";
  const isDepartmentHead = role?.key === "department_head";
  const isBranchHead = role?.key === "branch_head";
  const canManageFleet = isVehicles || isAdmin;
  const canRequest = isDepartmentHead || isAdmin;
  const [section, setSection] = useState<FleetSection>("vehicles");
  const [vehicleEditor, setVehicleEditor] = useState<FleetVehicle | "new" | null>(null);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [needOpen, setNeedOpen] = useState(false);

  const vehicles = app.fleetVehicles ?? [];
  const maintenance = useMemo(() => {
    const source = app.maintenanceRequests ?? [];
    return (isVehicles || isBranchHead || isAdmin ? source : source.filter((r) => r.requesterId === currentUser.id))
      .slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [app.maintenanceRequests, currentUser.id, isVehicles, isBranchHead, isAdmin]);
  const needs = useMemo(() => {
    const source = app.vehicleNeedRequests ?? [];
    return (isVehicles || isBranchHead || isAdmin ? source : source.filter((r) => r.requesterId === currentUser.id))
      .slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [app.vehicleNeedRequests, currentUser.id, isVehicles, isBranchHead, isAdmin]);

  const counts = {
    available: vehicles.filter((v) => v.status === "available").length,
    assigned: vehicles.filter((v) => v.status === "assigned").length,
    maintenance: vehicles.filter((v) => v.status === "maintenance").length,
    out: vehicles.filter((v) => v.status === "out_of_service").length,
  };

  function vehicleUsers() {
    return org.users.filter((u) => u.active && roleOf(org, u)?.key === "vehicles");
  }

  function saveVehicle(input: Omit<FleetVehicle, "id" | "createdAt" | "updatedAt">, existing?: FleetVehicle) {
    const at = nowIso();
    const next: FleetVehicle = existing
      ? { ...existing, ...input, updatedAt: at }
      : { ...input, id: uid(), createdAt: at, updatedAt: at };
    setApp((state) => ({ ...state, fleetVehicles: existing ? (state.fleetVehicles ?? []).map((v) => v.id === existing.id ? next : v) : [next, ...(state.fleetVehicles ?? [])] }));
    setVehicleEditor(null);
  }

  function deleteVehicle(vehicle: FleetVehicle) {
    const openMaintenance = (app.maintenanceRequests ?? []).some((r) => r.vehicleId === vehicle.id && !["completed", "rejected"].includes(r.status));
    const openNeed = (app.vehicleNeedRequests ?? []).some((r) => (r.approvedVehicleIds ?? []).includes(vehicle.id) && !["completed", "rejected"].includes(r.status));
    if (openMaintenance || openNeed) {
      window.alert("لا يمكن حذف المركبة وهي مرتبطة بطلب مفتوح. أغلق الطلب أولاً.");
      return;
    }
    if (!window.confirm(`حذف المركبة ${vehicleLabel(vehicle)}؟`)) return;
    setApp((state) => ({ ...state, fleetVehicles: (state.fleetVehicles ?? []).filter((v) => v.id !== vehicle.id) }));
  }

  function createMaintenance(vehicleId: string, reason: string) {
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (!vehicle || !reason.trim()) return;
    const at = nowIso();
    const request: VehicleMaintenanceRequest = {
      id: uid(), requesterId: currentUser.id, departmentId: currentUser.departmentId,
      vehicleId: vehicle.id, vehicleLabel: vehicleLabel(vehicle), reason: reason.trim(),
      requestedAt: at, updatedAt: at, status: "requested",
    };
    setApp((state) => ({ ...state, maintenanceRequests: [request, ...(state.maintenanceRequests ?? [])] }));
    vehicleUsers().forEach((u) => onNotify(u.id, `طلب صيانة مركبة جديد من ${currentUser.name}: ${request.vehicleLabel}`));
    setMaintenanceOpen(false); setSection("maintenance");
  }

  function replyMaintenance(request: VehicleMaintenanceRequest, status: MaintenanceRequestStatus, scheduledDate?: string, replacementVehicleId?: string, reply?: string) {
    const at = nowIso();
    const replacement = vehicles.find((v) => v.id === replacementVehicleId);
    setApp((state) => {
      let fleet = state.fleetVehicles ?? [];
      if (status === "in_maintenance") {
        fleet = fleet.map((v) => v.id === request.vehicleId ? { ...v, status: "maintenance", updatedAt: at } : v.id === replacementVehicleId ? { ...v, status: "assigned", updatedAt: at } : v);
      }
      if (status === "completed") {
        fleet = fleet.map((v) => v.id === request.vehicleId ? { ...v, status: "available", updatedAt: at } : v.id === request.replacementVehicleId ? { ...v, status: "available", updatedAt: at } : v);
      }
      return {
        ...state, fleetVehicles: fleet,
        maintenanceRequests: (state.maintenanceRequests ?? []).map((r) => r.id === request.id ? {
          ...r, status, scheduledDate: scheduledDate || r.scheduledDate,
          replacementVehicleId: replacementVehicleId || r.replacementVehicleId,
          replacementVehicleLabel: replacement ? vehicleLabel(replacement) : r.replacementVehicleLabel,
          vehiclesReply: reply?.trim() || r.vehiclesReply,
          completedAt: status === "completed" ? at : r.completedAt,
          updatedAt: at,
        } : r),
      };
    });
    onNotify(request.requesterId,
      status === "rejected" ? `تم رفض طلب صيانة المركبة: ${request.vehicleLabel}`
      : status === "scheduled" ? `تم تحديد موعد صيانة المركبة ${request.vehicleLabel} بتاريخ ${scheduledDate || "محدد"}`
      : status === "in_maintenance" ? `دخلت المركبة الصيانة: ${request.vehicleLabel}`
      : `تم إنهاء صيانة المركبة: ${request.vehicleLabel}`);
  }

  function deleteMaintenanceRequest(request: VehicleMaintenanceRequest) {
    if (!isAdmin) return;
    if (!window.confirm(`حذف طلب الصيانة «${request.vehicleLabel}» من السجل نهائياً؟`)) return;
    const at = nowIso();
    setApp((state) => {
      const releasedIds = new Set<string>();
      if (request.status === "in_maintenance") {
        releasedIds.add(request.vehicleId);
        if (request.replacementVehicleId) releasedIds.add(request.replacementVehicleId);
      }
      const fleet = (state.fleetVehicles ?? []).map((vehicle) =>
        releasedIds.has(vehicle.id) ? { ...vehicle, status: "available" as FleetVehicleStatus, updatedAt: at } : vehicle
      );
      return {
        ...state,
        fleetVehicles: fleet,
        maintenanceRequests: (state.maintenanceRequests ?? []).filter((item) => item.id !== request.id),
      };
    });
  }

  function deleteVehicleNeedRequest(request: VehicleNeedRequest) {
    if (!isAdmin) return;
    if (!window.confirm(`حذف طلب المركبات بتاريخ ${request.neededDate} من السجل نهائياً؟`)) return;
    const at = nowIso();
    setApp((state) => {
      const allocated = new Set(request.approvedVehicleIds ?? []);
      const fleet = (state.fleetVehicles ?? []).map((vehicle) =>
        allocated.has(vehicle.id) ? { ...vehicle, status: "available" as FleetVehicleStatus, updatedAt: at } : vehicle
      );
      return {
        ...state,
        fleetVehicles: fleet,
        vehicleNeedRequests: (state.vehicleNeedRequests ?? []).filter((item) => item.id !== request.id),
      };
    });
  }

  function createVehicleNeed(quantity: number, neededDate: string, lines: VehicleNeedLine[]) {
    const normalized = lines.slice(0, quantity).map((line) => ({ ...line, destination: line.destination.trim(), userName: line.userName.trim(), purpose: line.purpose?.trim() }));
    if (!neededDate || normalized.some((line) => !line.destination || !line.userName)) return;
    const at = nowIso();
    const request: VehicleNeedRequest = {
      id: uid(), requesterId: currentUser.id, departmentId: currentUser.departmentId,
      neededDate, quantity, lines: normalized, requestedAt: at, updatedAt: at, status: "requested",
    };
    setApp((state) => ({ ...state, vehicleNeedRequests: [request, ...(state.vehicleNeedRequests ?? [])] }));
    vehicleUsers().forEach((u) => onNotify(u.id, `طلب ${quantity} مركبة من ${currentUser.name} لتاريخ ${neededDate}`));
    setNeedOpen(false); setSection("requests");
  }

  function replyNeed(request: VehicleNeedRequest, status: VehicleNeedStatus, selectedIds: string[], reply: string) {
    const at = nowIso();
    const selected = vehicles.filter((v) => selectedIds.includes(v.id));
    setApp((state) => {
      let fleet = state.fleetVehicles ?? [];
      if (status === "approved" || status === "partial") {
        fleet = fleet.map((v) => selectedIds.includes(v.id) ? { ...v, status: "assigned", updatedAt: at } : v);
      }
      if (status === "completed") {
        const allocated = request.approvedVehicleIds ?? [];
        fleet = fleet.map((v) => allocated.includes(v.id) ? { ...v, status: "available", updatedAt: at } : v);
      }
      return {
        ...state, fleetVehicles: fleet,
        vehicleNeedRequests: (state.vehicleNeedRequests ?? []).map((r) => r.id === request.id ? {
          ...r, status,
          approvedVehicleIds: (status === "approved" || status === "partial") ? selectedIds : r.approvedVehicleIds,
          approvedVehicleLabels: (status === "approved" || status === "partial") ? selected.map(vehicleLabel) : r.approvedVehicleLabels,
          vehiclesReply: reply.trim() || r.vehiclesReply,
          completedAt: status === "completed" ? at : r.completedAt,
          updatedAt: at,
        } : r),
      };
    });
    onNotify(request.requesterId,
      status === "rejected" ? `تعذر تأمين طلب المركبات بتاريخ ${request.neededDate}`
      : status === "partial" ? `تم تأمين جزء من طلب المركبات بتاريخ ${request.neededDate}`
      : status === "approved" ? `تمت الموافقة على طلب المركبات بتاريخ ${request.neededDate}`
      : `تم إغلاق طلب المركبات بتاريخ ${request.neededDate}`);
  }

  return <div className="mx-auto max-w-6xl space-y-5">
    <section className="tech-panel p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><div className="gold-kicker">FLEET OPERATIONS</div><h1 className="mt-2 text-2xl font-black">إدارة الآليات والمركبات</h1><p className="mt-2 text-[11px] leading-6 text-slate-500">سجل المركبات، طلبات الصيانة، وطلبات تأمين المركبات للأقسام.</p></div>
        <div className="flex flex-wrap gap-2">
          {canRequest && <button onClick={() => setMaintenanceOpen(true)} className="report-action flex h-10 items-center gap-2 rounded-xl border px-3 text-[10px] font-black"><Wrench size={14}/>طلب صيانة</button>}
          {canRequest && <button onClick={() => setNeedOpen(true)} className="gold-action flex h-10 items-center gap-2 rounded-xl px-3 text-[10px] font-black"><CarFront size={14}/>طلب مركبات للغد</button>}
          {canManageFleet && <button onClick={() => setVehicleEditor("new")} className="gold-action flex h-10 items-center gap-2 rounded-xl px-3 text-[10px] font-black"><Plus size={14}/>إضافة مركبة</button>}
        </div>
      </div>
    </section>

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <FleetMetric label="متاحة" value={counts.available}/>
      <FleetMetric label="مخصصة" value={counts.assigned}/>
      <FleetMetric label="في الصيانة" value={counts.maintenance}/>
      <FleetMetric label="خارج الخدمة" value={counts.out}/>
    </div>

    <div className="tech-panel flex flex-wrap gap-2 p-2">
      <Tab active={section === "vehicles"} onClick={() => setSection("vehicles")} label="سجل المركبات"/>
      <Tab active={section === "maintenance"} onClick={() => setSection("maintenance")} label={`طلبات الصيانة (${maintenance.length})`}/>
      <Tab active={section === "requests"} onClick={() => setSection("requests")} label={`طلبات المركبات (${needs.length})`}/>
    </div>

    {section === "vehicles" && <VehicleBoard vehicles={vehicles} canManage={canManageFleet} onEdit={(v) => setVehicleEditor(v)} onDelete={deleteVehicle}/>}
    {section === "maintenance" && <MaintenanceList requests={maintenance} vehicles={vehicles} org={org} canReply={canManageFleet} canDelete={isAdmin} onReply={replyMaintenance} onDelete={deleteMaintenanceRequest}/>}
    {section === "requests" && <NeedList requests={needs} vehicles={vehicles} org={org} canReply={canManageFleet} canDelete={isAdmin} onReply={replyNeed} onDelete={deleteVehicleNeedRequest}/>}

    {vehicleEditor && <VehicleEditor value={vehicleEditor === "new" ? undefined : vehicleEditor} onClose={() => setVehicleEditor(null)} onSave={saveVehicle}/>}
    {maintenanceOpen && <MaintenanceDialog vehicles={vehicles} onClose={() => setMaintenanceOpen(false)} onCreate={createMaintenance}/>}
    {needOpen && <NeedDialog onClose={() => setNeedOpen(false)} onCreate={createVehicleNeed}/>}
  </div>;
}

function FleetMetric({ label, value }: { label: string; value: number }) {
  return <div className="tech-panel p-4"><div className="font-mono text-2xl font-black">{String(value).padStart(2, "0")}</div><div className="mt-1 text-[10px] text-slate-500">{label}</div></div>;
}

function Tab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return <button onClick={onClick} className={`rounded-xl border px-4 py-2.5 text-[10px] font-black ${active ? "border-[#c7ad72]/25 bg-[#c7ad72]/10 text-[#e2d3a4]" : "border-transparent text-slate-500 hover:bg-white/5"}`}>{label}</button>;
}

function VehicleBoard({ vehicles, canManage, onEdit, onDelete }: { vehicles: FleetVehicle[]; canManage: boolean; onEdit: (v: FleetVehicle) => void; onDelete: (v: FleetVehicle) => void }) {
  const groups: Array<{ status: FleetVehicleStatus; title: string }> = [
    { status: "available", title: "المركبات المتاحة" },
    { status: "assigned", title: "المركبات المخصصة" },
    { status: "maintenance", title: "في الصيانة" },
    { status: "out_of_service", title: "خارج الخدمة" },
  ];
  return <div className="grid gap-4 xl:grid-cols-2">{groups.map((group) => {
    const rows = vehicles.filter((v) => v.status === group.status).sort((a,b)=>a.plateNumber.localeCompare(b.plateNumber));
    return <section key={group.status} className="tech-panel overflow-hidden"><div className="flex items-center justify-between border-b border-white/7 px-5 py-4"><h2 className="text-sm font-black">{group.title}</h2><span className="font-mono text-[10px] text-slate-500">{rows.length}</span></div>
      <div className="divide-y divide-white/7">{rows.length ? rows.map((v) => <div key={v.id} className="flex items-center gap-3 px-5 py-4">
        <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/8 bg-white/[0.025]"><CarFront size={18} className={vehicleStatusMeta[v.status].tone}/></div>
        <div className="min-w-0 flex-1"><div className="font-bold">{vehicleLabel(v)}</div><div className="mt-1 flex flex-wrap gap-2 text-[9px] text-slate-500"><span>{vehicleStatusMeta[v.status].label}</span>{v.type && <span>{v.type}</span>}{v.fuelCard && <span className="inline-flex items-center gap-1 text-amber-300"><Fuel size={10}/>بطاقة وقود{v.fuelCardNumber ? ` — ${v.fuelCardNumber}` : ""}</span>}</div>{v.notes && <div className="mt-1 text-[9px] text-slate-600">{v.notes}</div>}</div>
        {canManage && <div className="flex gap-1"><button onClick={() => onEdit(v)} className="grid h-8 w-8 place-items-center rounded-lg border border-white/8 text-slate-400 hover:text-white"><Pencil size={13}/></button><button onClick={() => onDelete(v)} className="grid h-8 w-8 place-items-center rounded-lg border border-rose-300/10 text-rose-300"><Trash2 size={13}/></button></div>}
      </div>) : <div className="p-7 text-center text-[10px] text-slate-600">لا توجد مركبات في هذه الحالة.</div>}</div>
    </section>;
  })}</div>;
}

function VehicleEditor({ value, onClose, onSave }: { value?: FleetVehicle; onClose: () => void; onSave: (input: Omit<FleetVehicle,"id"|"createdAt"|"updatedAt">, existing?: FleetVehicle) => void }) {
  const [plateNumber,setPlateNumber]=useState(value?.plateNumber ?? "");
  const [make,setMake]=useState(value?.make ?? "");
  const [model,setModel]=useState(value?.model ?? "");
  const [type,setType]=useState(value?.type ?? "");
  const [year,setYear]=useState(value?.year ?? "");
  const [color,setColor]=useState(value?.color ?? "");
  const [fuelCard,setFuelCard]=useState(value?.fuelCard ?? false);
  const [fuelCardNumber,setFuelCardNumber]=useState(value?.fuelCardNumber ?? "");
  const [status,setStatus]=useState<FleetVehicleStatus>(value?.status ?? "available");
  const [notes,setNotes]=useState(value?.notes ?? "");
  const valid=plateNumber.trim() && make.trim() && model.trim();
  return <Modal title={value ? "تعديل المركبة" : "إضافة مركبة"} onClose={onClose}><div className="grid gap-3 sm:grid-cols-2">
    <Input label="رقم اللوحة" value={plateNumber} onChange={setPlateNumber}/>
    <Input label="الشركة / الصانع" value={make} onChange={setMake}/>
    <Input label="الموديل" value={model} onChange={setModel}/>
    <Input label="النوع" value={type} onChange={setType}/>
    <Input label="السنة" value={year} onChange={setYear}/>
    <Input label="اللون" value={color} onChange={setColor}/>
    <label className="block"><span className="mb-2 block text-[9px] font-bold text-slate-500">الحالة</span><select className="tech-field" value={status} onChange={(e)=>setStatus(e.target.value as FleetVehicleStatus)}>{Object.entries(vehicleStatusMeta).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></label>
    <label className="flex items-center gap-3 rounded-xl border border-white/8 px-3 py-3 text-[10px] font-bold"><input type="checkbox" checked={fuelCard} onChange={(e)=>setFuelCard(e.target.checked)}/>يوجد بطاقة وقود</label>
    {fuelCard && <Input label="رقم / مرجع بطاقة الوقود" value={fuelCardNumber} onChange={setFuelCardNumber}/>}
  </div><label className="mt-3 block"><span className="mb-2 block text-[9px] font-bold text-slate-500">ملاحظات</span><textarea className="tech-field resize-none" rows={3} value={notes} onChange={(e)=>setNotes(e.target.value)}/></label>
  <div className="mt-5 flex justify-end gap-2"><button onClick={onClose} className="px-4 text-xs text-slate-500">إلغاء</button><button disabled={!valid} onClick={()=>onSave({plateNumber:plateNumber.trim(),make:make.trim(),model:model.trim(),type:type.trim(),year:year.trim(),color:color.trim(),fuelCard,fuelCardNumber:fuelCard?fuelCardNumber.trim():"",status,notes:notes.trim()},value)} className="gold-action h-10 rounded-xl px-4 text-[10px] font-black disabled:opacity-30">حفظ</button></div></Modal>;
}

function MaintenanceDialog({ vehicles, onClose, onCreate }: { vehicles: FleetVehicle[]; onClose:()=>void; onCreate:(vehicleId:string,reason:string)=>void }) {
  const [vehicleId,setVehicleId]=useState(vehicles[0]?.id ?? "");
  const [reason,setReason]=useState("");
  return <Modal title="طلب صيانة مركبة" onClose={onClose}><label className="block"><span className="mb-2 block text-[9px] font-bold text-slate-500">المركبة</span><select className="tech-field" value={vehicleId} onChange={(e)=>setVehicleId(e.target.value)}>{vehicles.map((v)=><option key={v.id} value={v.id}>{vehicleLabel(v)}</option>)}</select></label><label className="mt-3 block"><span className="mb-2 block text-[9px] font-bold text-slate-500">سبب / وصف الصيانة المطلوبة</span><textarea className="tech-field resize-none" rows={4} value={reason} onChange={(e)=>setReason(e.target.value)}/></label><div className="mt-5 flex justify-end gap-2"><button onClick={onClose} className="px-4 text-xs text-slate-500">إلغاء</button><button disabled={!vehicleId||!reason.trim()} onClick={()=>onCreate(vehicleId,reason)} className="gold-action h-10 rounded-xl px-4 text-[10px] font-black disabled:opacity-30">إرسال إلى الآليات</button></div></Modal>;
}

function MaintenanceList({ requests, vehicles, org, canReply, canDelete, onReply, onDelete }: { requests: VehicleMaintenanceRequest[]; vehicles: FleetVehicle[]; org: OrgState; canReply:boolean; canDelete:boolean; onReply:(r:VehicleMaintenanceRequest,s:MaintenanceRequestStatus,date?:string,replacementId?:string,reply?:string)=>void; onDelete:(r:VehicleMaintenanceRequest)=>void }) {
  return <div className="space-y-3">{requests.length ? requests.map((r)=><MaintenanceCard key={r.id} request={r} vehicles={vehicles} org={org} canReply={canReply} canDelete={canDelete} onReply={onReply} onDelete={onDelete}/>) : <Empty text="لا توجد طلبات صيانة."/ >}</div>;
}

function MaintenanceCard({ request, vehicles, org, canReply, canDelete, onReply, onDelete }: { request: VehicleMaintenanceRequest; vehicles:FleetVehicle[]; org:OrgState; canReply:boolean; canDelete:boolean; onReply:(r:VehicleMaintenanceRequest,s:MaintenanceRequestStatus,date?:string,replacementId?:string,reply?:string)=>void; onDelete:(r:VehicleMaintenanceRequest)=>void }) {
  const [date,setDate]=useState(request.scheduledDate ?? tomorrow());
  const [replacement,setReplacement]=useState(request.replacementVehicleId ?? "");
  const [reply,setReply]=useState(request.vehiclesReply ?? "");
  const requester=org.users.find((u)=>u.id===request.requesterId);
  const available=vehicles.filter((v)=>v.status==="available" && v.id!==request.vehicleId);
  return <section className="tech-panel p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-sm font-black">{request.vehicleLabel}</div><div className="mt-1 text-[9px] text-slate-500">الطالب: {requester?.name ?? "مستخدم"} — {new Date(request.requestedAt).toLocaleString("ar")}</div><p className="mt-3 text-xs leading-6 text-slate-300">{request.reason}</p></div><span className="rounded-lg border border-white/8 px-2 py-1 text-[9px] text-slate-400">{maintenanceStatusMeta[request.status]}</span></div>
  {request.scheduledDate && <div className="mt-3 text-[10px] text-amber-300">موعد الصيانة: {request.scheduledDate}</div>}
  {request.replacementVehicleLabel && <div className="mt-1 text-[10px] text-slate-400">المركبة البديلة: {request.replacementVehicleLabel}</div>}
  {request.vehiclesReply && <div className="mt-3 rounded-xl border border-white/7 bg-black/10 p-3 text-[10px] leading-5 text-slate-400">{request.vehiclesReply}</div>}
  {canReply && request.status==="requested" && <div className="mt-4 grid gap-2 md:grid-cols-3"><input type="date" className="tech-field" value={date} onChange={(e)=>setDate(e.target.value)}/><select className="tech-field" value={replacement} onChange={(e)=>setReplacement(e.target.value)}><option value="">بدون مركبة بديلة</option>{available.map((v)=><option key={v.id} value={v.id}>{vehicleLabel(v)}</option>)}</select><input className="tech-field" value={reply} onChange={(e)=>setReply(e.target.value)} placeholder="رد الآليات / ملاحظة"/></div>}
  {(canReply || canDelete) && <div className="mt-4 flex flex-wrap gap-2">{canReply && request.status==="requested" && <><button onClick={()=>onReply(request,"scheduled",date,replacement,reply)} className="gold-action rounded-xl px-3 py-2 text-[9px] font-black"><CalendarDays size={12} className="inline ml-1"/>تحديد الموعد</button><button onClick={()=>onReply(request,"rejected",undefined,undefined,reply)} className="rounded-xl border border-rose-300/15 px-3 py-2 text-[9px] font-black text-rose-300">رفض</button></>}{canReply && request.status==="scheduled" && <button onClick={()=>onReply(request,"in_maintenance")} className="rounded-xl border border-amber-300/15 bg-amber-300/5 px-3 py-2 text-[9px] font-black text-amber-300">دخلت الصيانة</button>}{canReply && request.status==="in_maintenance" && <button onClick={()=>onReply(request,"completed")} className="rounded-xl border border-emerald-300/15 bg-emerald-300/5 px-3 py-2 text-[9px] font-black text-emerald-300">تمت الصيانة وإعادة المركبة</button>}{canDelete && <button onClick={()=>onDelete(request)} className="mr-auto inline-flex items-center gap-1 rounded-xl border border-rose-300/15 bg-rose-300/[0.035] px-3 py-2 text-[9px] font-black text-rose-300"><Trash2 size={12}/>حذف من السجل</button>}</div>}
  </section>;
}

function NeedDialog({ onClose, onCreate }: { onClose:()=>void; onCreate:(quantity:number,date:string,lines:VehicleNeedLine[])=>void }) {
  const [quantity,setQuantity]=useState(1);
  const [date,setDate]=useState(tomorrow());
  const [lines,setLines]=useState<VehicleNeedLine[]>([{id:uid(),destination:"",userName:"",purpose:""}]);
  function setQty(q:number){ const next=Math.min(10,Math.max(1,q)); setQuantity(next); setLines((old)=>Array.from({length:next},(_,i)=>old[i]??{id:uid(),destination:"",userName:"",purpose:""}));}
  function editLine(index:number,key:keyof VehicleNeedLine,value:string){setLines((old)=>old.map((line,i)=>i===index?{...line,[key]:value}:line));}
  const valid=lines.slice(0,quantity).every((l)=>l.destination.trim()&&l.userName.trim());
  return <Modal title="طلب مركبات لليوم التالي" onClose={onClose}><div className="grid gap-3 sm:grid-cols-2"><label className="block"><span className="mb-2 block text-[9px] font-bold text-slate-500">العدد المطلوب</span><input className="tech-field" type="number" min={1} max={10} value={quantity} onChange={(e)=>setQty(Number(e.target.value))}/></label><label className="block"><span className="mb-2 block text-[9px] font-bold text-slate-500">تاريخ الحاجة</span><input className="tech-field" type="date" value={date} onChange={(e)=>setDate(e.target.value)}/></label></div><div className="mt-4 space-y-3">{lines.slice(0,quantity).map((line,index)=><div key={line.id} className="rounded-xl border border-white/8 p-3"><div className="mb-2 text-[9px] font-black text-[#e2d3a4]">المركبة المطلوبة رقم {index+1}</div><div className="grid gap-2 sm:grid-cols-3"><input className="tech-field" placeholder="الوجهة" value={line.destination} onChange={(e)=>editLine(index,"destination",e.target.value)}/><input className="tech-field" placeholder="من سيستخدمها" value={line.userName} onChange={(e)=>editLine(index,"userName",e.target.value)}/><input className="tech-field" placeholder="الغرض — اختياري" value={line.purpose} onChange={(e)=>editLine(index,"purpose",e.target.value)}/></div></div>)}</div><div className="mt-5 flex justify-end gap-2"><button onClick={onClose} className="px-4 text-xs text-slate-500">إلغاء</button><button disabled={!valid||!date} onClick={()=>onCreate(quantity,date,lines)} className="gold-action h-10 rounded-xl px-4 text-[10px] font-black disabled:opacity-30">إرسال الطلب</button></div></Modal>;
}

function NeedList({ requests, vehicles, org, canReply, canDelete, onReply, onDelete }: { requests:VehicleNeedRequest[]; vehicles:FleetVehicle[]; org:OrgState; canReply:boolean; canDelete:boolean; onReply:(r:VehicleNeedRequest,s:VehicleNeedStatus,ids:string[],reply:string)=>void; onDelete:(r:VehicleNeedRequest)=>void }) {
  return <div className="space-y-3">{requests.length ? requests.map((r)=><NeedCard key={r.id} request={r} vehicles={vehicles} org={org} canReply={canReply} canDelete={canDelete} onReply={onReply} onDelete={onDelete}/>) : <Empty text="لا توجد طلبات مركبات."/ >}</div>;
}

function NeedCard({ request, vehicles, org, canReply, canDelete, onReply, onDelete }: { request:VehicleNeedRequest; vehicles:FleetVehicle[]; org:OrgState; canReply:boolean; canDelete:boolean; onReply:(r:VehicleNeedRequest,s:VehicleNeedStatus,ids:string[],reply:string)=>void; onDelete:(r:VehicleNeedRequest)=>void }) {
  const [selected,setSelected]=useState<string[]>(request.approvedVehicleIds ?? []);
  const [reply,setReply]=useState(request.vehiclesReply ?? "");
  const requester=org.users.find((u)=>u.id===request.requesterId);
  const available=vehicles.filter((v)=>v.status==="available" || selected.includes(v.id));
  const canDecision=canReply && request.status==="requested";
  return <section className="tech-panel p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-sm font-black">طلب {request.quantity} مركبة — {request.neededDate}</div><div className="mt-1 text-[9px] text-slate-500">الطالب: {requester?.name ?? "مستخدم"}</div></div><span className="rounded-lg border border-white/8 px-2 py-1 text-[9px] text-slate-400">{needStatusMeta[request.status]}</span></div>
  <div className="mt-4 grid gap-2 md:grid-cols-2">{request.lines.map((line,index)=><div key={line.id} className="rounded-xl border border-white/7 bg-black/10 p-3 text-[10px]"><b className="text-[#e2d3a4]">{index+1}.</b> الوجهة: <b>{line.destination}</b> — المستخدم: <b>{line.userName}</b>{line.purpose ? ` — ${line.purpose}` : ""}</div>)}</div>
  {request.approvedVehicleLabels?.length ? <div className="mt-3 text-[10px] text-emerald-300">المركبات المعتمدة: {request.approvedVehicleLabels.join("، ")}</div> : null}
  {request.vehiclesReply && <div className="mt-3 rounded-xl border border-white/7 bg-black/10 p-3 text-[10px] leading-5 text-slate-400">{request.vehiclesReply}</div>}
  {canDecision && <><div className="mt-4"><div className="mb-2 text-[9px] font-black text-slate-500">اختر المركبات المتاحة</div><div className="flex flex-wrap gap-2">{available.map((v)=><label key={v.id} className={`cursor-pointer rounded-xl border px-3 py-2 text-[9px] ${selected.includes(v.id)?"border-[#c7ad72]/30 bg-[#c7ad72]/8 text-[#e2d3a4]":"border-white/8 text-slate-400"}`}><input type="checkbox" className="ml-2" checked={selected.includes(v.id)} onChange={(e)=>setSelected((old)=>e.target.checked?[...old,v.id]:old.filter((id)=>id!==v.id))}/>{vehicleLabel(v)}</label>)}</div></div><input className="tech-field mt-3" value={reply} onChange={(e)=>setReply(e.target.value)} placeholder="ملاحظة الآليات / سبب عدم التوفر إن وجد"/></>}
  {(canReply || canDelete) && <div className="mt-4 flex flex-wrap gap-2">{canReply && canDecision && <><button disabled={!selected.length} onClick={()=>onReply(request,selected.length>=request.quantity?"approved":"partial",selected,reply)} className="gold-action rounded-xl px-3 py-2 text-[9px] font-black disabled:opacity-30"><Check size={12} className="inline ml-1"/>{selected.length>=request.quantity?"موافقة":"موافقة جزئية"}</button><button onClick={()=>onReply(request,"rejected",[],reply)} className="rounded-xl border border-rose-300/15 px-3 py-2 text-[9px] font-black text-rose-300"><CircleX size={12} className="inline ml-1"/>غير متاح</button></>}{canReply && ["approved","partial"].includes(request.status) && <button onClick={()=>onReply(request,"completed",request.approvedVehicleIds ?? [],reply)} className="rounded-xl border border-emerald-300/15 bg-emerald-300/5 px-3 py-2 text-[9px] font-black text-emerald-300">إنهاء الطلب وإتاحة المركبات</button>}{canDelete && <button onClick={()=>onDelete(request)} className="mr-auto inline-flex items-center gap-1 rounded-xl border border-rose-300/15 bg-rose-300/[0.035] px-3 py-2 text-[9px] font-black text-rose-300"><Trash2 size={12}/>حذف من السجل</button>}</div>}
  </section>;
}

function Input({ label, value, onChange }: { label:string; value:string; onChange:(v:string)=>void }) { return <label className="block"><span className="mb-2 block text-[9px] font-bold text-slate-500">{label}</span><input className="tech-field" value={value} onChange={(e)=>onChange(e.target.value)}/></label>; }
function Empty({ text }: { text:string }) { return <div className="tech-panel p-10 text-center text-xs text-slate-600">{text}</div>; }
function Modal({ title, onClose, children }: { title:string; onClose:()=>void; children:React.ReactNode }) { return <div className="fixed inset-0 z-[190] grid place-items-center overflow-y-auto bg-black/75 p-4 backdrop-blur-lg"><div className="tech-panel my-8 w-full max-w-2xl p-6"><div className="flex items-center justify-between"><h2 className="text-lg font-black">{title}</h2><button onClick={onClose} className="rounded-lg border border-white/8 px-3 py-2 text-[10px] text-slate-400">إغلاق</button></div><div className="mt-5">{children}</div></div></div>; }
