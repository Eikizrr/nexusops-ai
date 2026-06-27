import { describe, expect, it } from "vitest";
import { projectSchema } from "./projects";

describe("projectSchema", () => {
  it("rejeita dados fracos antes de salvar", () => {
    const result = projectSchema.safeParse({
      client: "A",
      owner: "",
      email: "email-invalido",
      title: "Ops",
      budget: 100,
      progress: 140,
      status: "active",
      priority: "high",
      dueDate: "",
      notes: "curto"
    });

    expect(result.success).toBe(false);
  });

  it("aceita um projeto pronto para entrar no pipeline", () => {
    const result = projectSchema.safeParse({
      client: "Acme Operations",
      owner: "Nexus Demo",
      email: "erick@acme.dev",
      title: "Dashboard de operações",
      budget: 12000,
      progress: 40,
      status: "active",
      priority: "high",
      dueDate: "2026-08-20",
      notes: "Entrega com integração de dados e IA."
    });

    expect(result.success).toBe(true);
  });
});
