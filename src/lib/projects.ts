import { z } from "zod";
import { seedProjects } from "../data/seed";
import type { Project } from "../types";
import { readStorage, writeStorage } from "./storage";

const PROJECTS_KEY = "nexusops:projects";

export const projectSchema = z.object({
  client: z.string().min(3, "Informe o nome do cliente."),
  owner: z.string().min(3, "Informe o responsável."),
  email: z.string().email("Digite um e-mail válido."),
  title: z.string().min(5, "Descreva melhor o projeto."),
  budget: z.coerce.number().min(1000, "O orçamento mínimo é R$ 1.000."),
  progress: z.coerce.number().min(0).max(100),
  status: z.enum(["lead", "active", "paused", "done"]),
  priority: z.enum(["low", "medium", "high"]),
  dueDate: z.string().min(1, "Informe o prazo."),
  notes: z.string().min(10, "Adicione uma observação útil.")
});

export type ProjectInput = z.infer<typeof projectSchema>;

export function loadProjects() {
  return readStorage<Project[]>(PROJECTS_KEY, seedProjects);
}

export function saveProjects(projects: Project[]) {
  writeStorage(PROJECTS_KEY, projects);
}

export function upsertProject(projects: Project[], input: ProjectInput, id?: string) {
  const now = new Date().toISOString();
  const nextProject: Project = {
    ...input,
    id: id ?? crypto.randomUUID(),
    createdAt: projects.find((project) => project.id === id)?.createdAt ?? now
  };

  return id
    ? projects.map((project) => (project.id === id ? nextProject : project))
    : [nextProject, ...projects];
}
