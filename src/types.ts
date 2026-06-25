export type ProjectStatus = "lead" | "active" | "paused" | "done";
export type ProjectPriority = "low" | "medium" | "high";
export type UserRole = "admin" | "manager" | "analyst";

export type Project = {
  id: string;
  client: string;
  owner: string;
  email: string;
  title: string;
  budget: number;
  progress: number;
  status: ProjectStatus;
  priority: ProjectPriority;
  dueDate: string;
  notes: string;
  createdAt: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export type ActivityLog = {
  id: string;
  type: "created" | "updated" | "deleted" | "ai" | "weather" | "demo";
  title: string;
  description: string;
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  author: string;
  role: "user" | "assistant" | "system";
  body: string;
  createdAt: string;
};

export type WeatherInsight = {
  fetchedAt: string;
  city: string;
  currentTemperature: number;
  currentHumidity: number;
  currentWind: number;
  avgNext12hTemp: number;
  rainRisk: number;
  maxWindNext12h: number;
  recommendation: string;
};
