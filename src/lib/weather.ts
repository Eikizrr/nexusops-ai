import type { WeatherInsight } from "../types";

type OpenMeteoResponse = {
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
  };
  hourly: {
    temperature_2m: number[];
    precipitation_probability: number[];
    wind_speed_10m: number[];
  };
};

const MANAUS = {
  city: "Manaus, AM",
  latitude: -3.119,
  longitude: -60.0217
};

const avg = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);

export async function fetchWeatherInsight(): Promise<WeatherInsight> {
  const params = new URLSearchParams({
    latitude: String(MANAUS.latitude),
    longitude: String(MANAUS.longitude),
    current: "temperature_2m,relative_humidity_2m,wind_speed_10m",
    hourly: "temperature_2m,precipitation_probability,wind_speed_10m",
    timezone: "America/Manaus",
    forecast_days: "2"
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!response.ok) throw new Error("Não foi possível carregar a API climática.");

  const data = (await response.json()) as OpenMeteoResponse;
  const next12Temps = data.hourly.temperature_2m.slice(0, 12);
  const next12Rain = data.hourly.precipitation_probability.slice(0, 12);
  const next12Wind = data.hourly.wind_speed_10m.slice(0, 12);
  const rainRisk = Math.max(...next12Rain);
  const maxWindNext12h = Math.max(...next12Wind);

  let recommendation = "Agenda normal. Bom momento para manter entregas externas planejadas.";
  if (rainRisk >= 70) recommendation = "Alto risco de chuva: priorize tarefas remotas e confirme deslocamentos.";
  else if (maxWindNext12h >= 28) recommendation = "Vento elevado: revise prazos de campo e logística sensível.";
  else if (avg(next12Temps) >= 33) recommendation = "Calor forte: programe pausas e reduza atividades externas longas.";

  return {
    fetchedAt: new Date().toISOString(),
    city: MANAUS.city,
    currentTemperature: data.current.temperature_2m,
    currentHumidity: data.current.relative_humidity_2m,
    currentWind: data.current.wind_speed_10m,
    avgNext12hTemp: Number(avg(next12Temps).toFixed(1)),
    rainRisk,
    maxWindNext12h,
    recommendation
  };
}
