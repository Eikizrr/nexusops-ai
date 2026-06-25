import { describe, expect, it } from "vitest";
import type { Project } from "../types";
import { getDeliveryRisk, getRevenueByStatus, getSmartAlerts } from "./analytics";

const baseProject: Project = {
  id: "p-test",
  client: "Acme",
  owner: "Erick",
  email: "ops@acme.dev",
  title: "Operacao critica",
  budget: 10000,
  progress: 30,
  status: "active",
  priority: "high",
  dueDate: new Date(Date.now() + 86_400_000).toISOString(),
  notes: "Projeto com alto impacto operacional.",
  createdAt: new Date().toISOString()
};

describe("analytics", () => {
  it("soma receita por status", () => {
    const result = getRevenueByStatus([
      baseProject,
      { ...baseProject, id: "p-2", status: "lead", budget: 5000 },
      { ...baseProject, id: "p-3", status: "active", budget: 7000 }
    ]);

    expect(result.find((item) => item.key === "active")?.value).toBe(17000);
    expect(result.find((item) => item.key === "lead")?.value).toBe(5000);
  });

  it("calcula risco alto para projeto urgente", () => {
    expect(getDeliveryRisk(baseProject)).toBeGreaterThanOrEqual(80);
  });

  it("gera alerta quando risco operacional e clima se combinam", () => {
    const alerts = getSmartAlerts([baseProject], {
      fetchedAt: new Date().toISOString(),
      city: "Manaus, AM",
      currentTemperature: 32,
      currentHumidity: 80,
      currentWind: 12,
      avgNext12hTemp: 31,
      rainRisk: 85,
      maxWindNext12h: 20,
      recommendation: "Replaneje atividades externas."
    });

    expect(alerts[0].id).toBe("weather-risk");
    expect(alerts.length).toBeGreaterThan(1);
  });
});
