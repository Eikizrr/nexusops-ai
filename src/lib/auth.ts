import type { User } from "../types";

const AUTH_KEY = "nexusops:user";
const DEMO_EMAIL = "demo@nexusops.ai";
const DEMO_PASSWORD = "NexusDemo@2026";

export function getStoredUser(): User | null {
  const raw = localStorage.getItem(AUTH_KEY);
  return raw ? (JSON.parse(raw) as User) : null;
}

export function logout() {
  localStorage.removeItem(AUTH_KEY);
}

export function persistUser(user: User) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
}

export function validateCredentials(email: string, password: string) {
  const errors: Record<string, string> = {};
  if (!/^\S+@\S+\.\S+$/.test(email)) errors.email = "Digite um e-mail válido.";
  if (password.length < 8) errors.password = "A senha precisa ter ao menos 8 caracteres.";
  if (email && password && (email !== DEMO_EMAIL || password !== DEMO_PASSWORD)) {
    errors.general = "Use o acesso demo exibido na tela.";
  }
  return errors;
}

export function login(email: string, password: string): User {
  const errors = validateCredentials(email, password);
  if (Object.keys(errors).length) throw errors;

  const user: User = { id: crypto.randomUUID(), name: "Nexus Demo", email, role: "admin" };
  persistUser(user);
  return user;
}

export const demoCredentials = {
  email: DEMO_EMAIL,
  password: DEMO_PASSWORD
};
