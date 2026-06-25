import type { ActivityLog } from "../types";
import { readStorage, writeStorage } from "./storage";

const ACTIVITY_KEY = "nexusops:activity";

export function loadActivity() {
  return readStorage<ActivityLog[]>(ACTIVITY_KEY, [
    {
      id: "a-001",
      type: "weather",
      title: "Clima operacional sincronizado",
      description: "Open-Meteo conectado ao centro de decisoes para apoiar prazos e atividades externas.",
      createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString()
    },
    {
      id: "a-002",
      type: "ai",
      title: "Copiloto pronto para briefing",
      description: "Resumo executivo gerado a partir de pipeline, prioridade e progresso dos projetos.",
      createdAt: new Date(Date.now() - 1000 * 60 * 70).toISOString()
    }
  ]);
}

export function saveActivity(activity: ActivityLog[]) {
  writeStorage(ACTIVITY_KEY, activity.slice(0, 16));
}

export function createActivity(type: ActivityLog["type"], title: string, description: string): ActivityLog {
  return {
    id: crypto.randomUUID(),
    type,
    title,
    description,
    createdAt: new Date().toISOString()
  };
}
