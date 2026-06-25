import type { ActivityLog, Project } from "../types";
import type { User } from "../types";
import type { ProjectInput } from "./projects";

type ApiOptions = {
  method?: string;
  body?: string;
  headers?: Record<string, string>;
};

async function request<T>(url: string, options?: ApiOptions): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers
    }
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    }),
  me: () => request<{ user: User }>("/api/auth/me"),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  listProjects: () => request<Project[]>("/api/projects"),
  createProject: (project: ProjectInput) =>
    request<Project>("/api/projects", {
      method: "POST",
      body: JSON.stringify(project)
    }),
  updateProject: (id: string, project: ProjectInput) =>
    request<Project>(`/api/projects/${id}`, {
      method: "PUT",
      body: JSON.stringify(project)
    }),
  deleteProject: (id: string) => request<void>(`/api/projects/${id}`, { method: "DELETE" }),
  listActivity: () => request<ActivityLog[]>("/api/activity")
};
