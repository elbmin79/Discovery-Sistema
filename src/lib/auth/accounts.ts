import type { DemoSession } from "../types";

export interface DemoAccount {
  username: string;
  password: string;
  role: "parent" | "staff";
  name: string;
  guardianId?: string;
  staffId?: string;
}

export const FAMILY_ACCOUNTS: DemoAccount[] = [
  {
    username: "roberto",
    password: "madrid",
    role: "parent",
    name: "Roberto Madrid",
    guardianId: "g-roberto",
  },
  {
    username: "benjamin",
    password: "marquez",
    role: "parent",
    name: "Benjamín Márquez",
    guardianId: "g-benjamin",
  },
];

export const STAFF_ACCOUNTS: DemoAccount[] = [
  {
    username: "gabriela",
    password: "salida",
    role: "staff",
    name: "Mtra. Gabriela Núñez",
    staffId: "st-gabriela",
  },
  {
    username: "alejandra",
    password: "preescolar",
    role: "staff",
    name: "Mtra. Alejandra Ríos",
    staffId: "st-alejandra",
  },
  {
    username: "luis",
    password: "primaria",
    role: "staff",
    name: "Mtro. Luis Ortega",
    staffId: "st-luis",
  },
];

const ALL_ACCOUNTS = [...FAMILY_ACCOUNTS, ...STAFF_ACCOUNTS];

export function authenticate(username: string, password: string): DemoSession | null {
  const account = ALL_ACCOUNTS.find(
    (item) =>
      item.username.toLowerCase() === username.trim().toLowerCase() &&
      item.password === password,
  );
  if (!account) return null;
  return {
    role: account.role,
    name: account.name,
    username: account.username,
    guardianId: account.guardianId,
    staffId: account.staffId,
  };
}
