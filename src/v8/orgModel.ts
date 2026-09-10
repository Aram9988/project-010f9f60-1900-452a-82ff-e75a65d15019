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
  updatedAt?: string;
};

export type OrgDepartment = {
  id: string;
  name: string;
  headUserId?: string;
  updatedAt?: string;
};

export type OrgOffice = {
  id: string;
  name: string;
  departmentId: string;
  responsibleUserId?: string;
  updatedAt?: string;
};

export type OrgUser = {
  id: string;
  name: string;
  username: string;
  password: string;
  roleId: string;
  avatarDataUrl?: string;
  title?: string;
  departmentId?: string;
  officeId?: string;
  managerId?: string;
  active: boolean;
  updatedAt?: string;
};

export type OrgState = {
  branchName: string;
  roles: OrgRole[];
  departments: OrgDepartment[];
  offices: OrgOffice[];
  users: OrgUser[];
  deletedUserIds?: string[];
  deletedRoleIds?: string[];
  deletedDepartmentIds?: string[];
  deletedOfficeIds?: string[];
};

export const ORG_STORAGE_KEY = "rif-dimashq-communications-org-v1";

export const SYSTEM_ADMIN_ID = "__system-administrator__";
export const SYSTEM_ADMIN_USERNAME = "administrator";
export const SYSTEM_ADMIN_ROLE: OrgRole = {
  id: "role-system-administrator",
  key: "branch_head",
  name: "Administrator",
  system: true,
  permissions: ["manage_structure", "manage_users", "manage_roles", "view_all_tree", "view_team_tree", "create_projects", "create_tasks", "assign_department_tasks", "assign_team_tasks", "approve_work", "view_reports"],
};
export const SYSTEM_ADMIN_USER: OrgUser = {
  id: SYSTEM_ADMIN_ID,
  name: "Administrator",
  username: SYSTEM_ADMIN_USERNAME,
  password: "",
  roleId: SYSTEM_ADMIN_ROLE.id,
  title: "System Administrator",
  active: true,
};

// These are the real operational role types required by the application.
// No users, departments, offices, projects, or tasks are automatically created.
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
  departments: [],
  offices: [],
  users: [],
  deletedUserIds: [],
  deletedRoleIds: [],
  deletedDepartmentIds: [],
  deletedOfficeIds: [],
};

function unique(values: string[] = []) { return [...new Set(values.filter(Boolean))]; }

export function normalizeOrgState(value: Partial<OrgState> | OrgState): OrgState {
  const deletedUserIds = unique(value.deletedUserIds);
  const deletedRoleIds = unique(value.deletedRoleIds);
  const deletedDepartmentIds = unique(value.deletedDepartmentIds);
  const deletedOfficeIds = unique(value.deletedOfficeIds);
  const deletedUsers = new Set(deletedUserIds);
  const deletedRoles = new Set(deletedRoleIds);
  const deletedDepartments = new Set(deletedDepartmentIds);
  const deletedOffices = new Set(deletedOfficeIds);

  const roles = (Array.isArray(value.roles) ? value.roles : defaultRoles).filter((r) => !deletedRoles.has(r.id));
  const departments = (Array.isArray(value.departments) ? value.departments : []).filter((d) => !deletedDepartments.has(d.id));
  const offices = (Array.isArray(value.offices) ? value.offices : []).filter((o) => !deletedOffices.has(o.id) && !deletedDepartments.has(o.departmentId));
  const users = (Array.isArray(value.users) ? value.users : []).filter((u) => !deletedUsers.has(u.id));

  return {
    branchName: value.branchName || seedOrgState.branchName,
    roles,
    departments,
    offices,
    users,
    deletedUserIds,
    deletedRoleIds,
    deletedDepartmentIds,
    deletedOfficeIds,
  };
}

export function loadOrgState(): OrgState {
  if (typeof window === "undefined") return normalizeOrgState(seedOrgState);
  try {
    const raw = localStorage.getItem(ORG_STORAGE_KEY);
    if (!raw) return normalizeOrgState(seedOrgState);
    return normalizeOrgState(JSON.parse(raw) as Partial<OrgState>);
  } catch {
    return normalizeOrgState(seedOrgState);
  }
}

export function saveOrgState(state: OrgState) {
  if (typeof window !== "undefined") localStorage.setItem(ORG_STORAGE_KEY, JSON.stringify(normalizeOrgState(state)));
}

export function roleOf(state: OrgState, user?: OrgUser) {
  if (!user) return undefined;
  if (user.id === SYSTEM_ADMIN_ID) return SYSTEM_ADMIN_ROLE;
  return state.roles.find((r) => r.id === user.roleId);
}

export function hasPermission(state: OrgState, user: OrgUser | undefined, permission: PermissionKey) {
  const role = roleOf(state, user);
  return !!role?.permissions.includes(permission);
}

export function descendants(state: OrgState, rootUserId: string) {
  const result: OrgUser[] = [];
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
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
