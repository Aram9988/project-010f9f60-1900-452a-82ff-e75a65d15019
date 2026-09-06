export type OrgRoleKey = "branch_head" | "department_head" | "office_responsible" | "member" | "diwan" | "administrative" | "vehicles" | string;

export type PermissionKey =
  | "manage_structure"
  | "manage_users"
  | "manage_roles"
  | "view_all_tree"
  | "view_team_tree"
  | "create_projects"
  | "create_tasks"
  | "assign_department_tasks"
  | "assign_team_tasks"
  | "approve_work"
  | "view_reports";

export type OrgRole = {
  id: string;
  name: string;
  key: OrgRoleKey;
  permissions: PermissionKey[];
  system?: boolean;
};

export type OrgDepartment = {
  id: string;
  name: string;
  headUserId?: string;
};

export type OrgOffice = {
  id: string;
  name: string;
  departmentId: string;
  responsibleUserId?: string;
};

export type OrgUser = {
  id: string;
  name: string;
  username: string;
  password: string;
  roleId: string;
  title?: string;
  departmentId?: string;
  officeId?: string;
  managerId?: string;
  active: boolean;
};

export type OrgState = {
  branchName: string;
  roles: OrgRole[];
  departments: OrgDepartment[];
  offices: OrgOffice[];
  users: OrgUser[];
};

export const ORG_STORAGE_KEY = "rif-dimashq-communications-org-v1";

export const defaultRoles: OrgRole[] = [
  { id: "role-branch-head", key: "branch_head", name: "رئيس الفرع", system: true, permissions: ["manage_structure", "manage_users", "manage_roles", "view_all_tree", "create_projects", "create_tasks", "assign_department_tasks", "assign_team_tasks", "approve_work", "view_reports"] },
  { id: "role-department-head", key: "department_head", name: "رئيس قسم", system: true, permissions: ["view_team_tree", "create_tasks", "assign_team_tasks", "view_reports"] },
  { id: "role-office-responsible", key: "office_responsible", name: "مسؤول مكتب", system: true, permissions: ["view_team_tree", "create_tasks", "assign_team_tasks"] },
  { id: "role-member", key: "member", name: "عنصر", system: true, permissions: [] },
  { id: "role-diwan", key: "diwan", name: "ديوان", system: true, permissions: ["view_reports"] },
  { id: "role-administrative", key: "administrative", name: "إداري", system: true, permissions: [] },
  { id: "role-vehicles", key: "vehicles", name: "آليات", system: true, permissions: [] },
];

export const seedOrgState: OrgState = {
  branchName: "فرع اتصالات ريف دمشق",
  roles: defaultRoles,
  departments: [
    { id: "studies", name: "قسم الدراسات", headUserId: "head-studies" },
    { id: "networks", name: "قسم الشبكات", headUserId: "head-networks" },
    { id: "support", name: "قسم الدعم الفني", headUserId: "head-support" },
    { id: "systems", name: "قسم الأنظمة", headUserId: "head-systems" },
  ],
  offices: [
    { id: "office-studies-1", name: "مكتب الدراسات والتصميم", departmentId: "studies", responsibleUserId: "office-studies" },
    { id: "office-networks-1", name: "مكتب الشبكات", departmentId: "networks", responsibleUserId: "office-networks" },
  ],
  users: [
    { id: "boss", name: "رئيس الفرع", username: "boss", password: "demo", roleId: "role-branch-head", title: "رئيس الفرع", active: true },
    { id: "head-studies", name: "رئيس قسم الدراسات", username: "studies", password: "demo", roleId: "role-department-head", title: "رئيس قسم الدراسات", departmentId: "studies", managerId: "boss", active: true },
    { id: "head-networks", name: "رئيس قسم الشبكات", username: "networks", password: "demo", roleId: "role-department-head", title: "رئيس قسم الشبكات", departmentId: "networks", managerId: "boss", active: true },
    { id: "head-support", name: "رئيس قسم الدعم الفني", username: "support", password: "demo", roleId: "role-department-head", title: "رئيس قسم الدعم الفني", departmentId: "support", managerId: "boss", active: true },
    { id: "head-systems", name: "رئيس قسم الأنظمة", username: "systems", password: "demo", roleId: "role-department-head", title: "رئيس قسم الأنظمة", departmentId: "systems", managerId: "boss", active: true },
    { id: "office-studies", name: "مسؤول مكتب الدراسات", username: "office.studies", password: "demo", roleId: "role-office-responsible", title: "مسؤول مكتب", departmentId: "studies", officeId: "office-studies-1", managerId: "head-studies", active: true },
    { id: "employee-studies", name: "عنصر الدراسات", username: "engineer", password: "demo", roleId: "role-member", title: "عنصر", departmentId: "studies", officeId: "office-studies-1", managerId: "office-studies", active: true },
    { id: "office-networks", name: "مسؤول مكتب الشبكات", username: "office.networks", password: "demo", roleId: "role-office-responsible", title: "مسؤول مكتب", departmentId: "networks", officeId: "office-networks-1", managerId: "head-networks", active: true },
    { id: "diwan-1", name: "مسؤول الديوان", username: "diwan", password: "demo", roleId: "role-diwan", title: "ديوان", managerId: "boss", active: true },
    { id: "admin-1", name: "الإداري", username: "admin", password: "demo", roleId: "role-administrative", title: "إداري", managerId: "boss", active: true },
    { id: "vehicles-1", name: "مسؤول الآليات", username: "vehicles", password: "demo", roleId: "role-vehicles", title: "آليات", managerId: "boss", active: true },
  ],
};

export function loadOrgState(): OrgState {
  if (typeof window === "undefined") return seedOrgState;
  try {
    const raw = localStorage.getItem(ORG_STORAGE_KEY);
    if (!raw) return seedOrgState;
    const parsed = JSON.parse(raw) as Partial<OrgState>;
    return {
      branchName: parsed.branchName || seedOrgState.branchName,
      roles: Array.isArray(parsed.roles) && parsed.roles.length ? parsed.roles : seedOrgState.roles,
      departments: Array.isArray(parsed.departments) ? parsed.departments : seedOrgState.departments,
      offices: Array.isArray(parsed.offices) ? parsed.offices : seedOrgState.offices,
      users: Array.isArray(parsed.users) && parsed.users.length ? parsed.users : seedOrgState.users,
    };
  } catch {
    return seedOrgState;
  }
}

export function saveOrgState(state: OrgState) {
  if (typeof window !== "undefined") localStorage.setItem(ORG_STORAGE_KEY, JSON.stringify(state));
}

export function roleOf(state: OrgState, user?: OrgUser) {
  return user ? state.roles.find((r) => r.id === user.roleId) : undefined;
}

export function hasPermission(state: OrgState, user: OrgUser | undefined, permission: PermissionKey) {
  const role = roleOf(state, user);
  return !!role?.permissions.includes(permission);
}

export function descendants(state: OrgState, rootUserId: string) {
  const result: OrgUser[] = [];
  const visit = (id: string) => {
    state.users.filter((u) => u.managerId === id && u.active).forEach((u) => {
      result.push(u);
      visit(u.id);
    });
  };
  visit(rootUserId);
  return result;
}

export function teamUserIds(state: OrgState, user: OrgUser) {
  return new Set([user.id, ...descendants(state, user.id).map((u) => u.id)]);
}
