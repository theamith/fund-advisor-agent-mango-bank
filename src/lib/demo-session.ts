export type Session = "maya" | "sam" | "admin";

const KEY = "mango-session";

export function readSession(): Session | null {
  if (typeof sessionStorage === "undefined") return null;
  const value = sessionStorage.getItem(KEY);
  return value === "maya" || value === "sam" || value === "admin" ? value : null;
}

export function writeSession(value: Session | null) {
  if (value) sessionStorage.setItem(KEY, value);
  else sessionStorage.removeItem(KEY);
}

export const RETAIL_LOGINS = [
  { id: "maya" as const, username: "maya", password: "mango", name: "Maya" },
  { id: "sam" as const, username: "sam", password: "mango", name: "Sam" },
];

export const ADMIN_LOGIN = { username: "ops", password: "mango", name: "Mango Bank operations" };
