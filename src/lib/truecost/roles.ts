export const TRUECOST_ROLES = ["host", "planner", "vendor", "admin"] as const;
export type TrueCostRole = (typeof TRUECOST_ROLES)[number];

export function isTrueCostRole(value: string): value is TrueCostRole {
  return (TRUECOST_ROLES as readonly string[]).includes(value);
}

export const EVENT_MEMBER_ROLES = ["owner", "editor", "collaborator", "viewer"] as const;
export type EventMemberRole = (typeof EVENT_MEMBER_ROLES)[number];

export function canEditEvent(role: EventMemberRole) {
  return role === "owner" || role === "editor";
}
