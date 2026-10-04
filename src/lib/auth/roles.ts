export type Role = "viewer" | "editor" | "legal_reviewer" | "superadmin";

export const ROLE_RANK: Record<Role, number> = {
  viewer: 0,
  editor: 1,
  legal_reviewer: 2,
  superadmin: 3,
};

export function hasRole(actual: Role | undefined, required: Role): boolean {
  if (!actual) return required === "viewer";
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

export const ROLE_LABELS: Record<Role, string> = {
  viewer: "Viewer",
  editor: "Editor",
  legal_reviewer: "Legal Reviewer",
  superadmin: "Super Admin",
};
