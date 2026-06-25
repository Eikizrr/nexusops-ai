import { randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import type { User, UserRole } from "../src/types";
import { prisma } from "./prisma";

const SESSION_COOKIE = "nexusops_session";
const DEMO_SALT = "nexusops-demo-salt";
const sessions = new Map<string, string>();

export function hashPassword(password: string) {
  return `${DEMO_SALT}:${scryptSync(password, DEMO_SALT, 64).toString("hex")}`;
}

function verifyPassword(password: string, storedHash: string) {
  const [salt, key] = storedHash.split(":");
  if (!salt || !key) return false;
  const candidate = scryptSync(password, salt, 64);
  const original = Buffer.from(key, "hex");
  return original.length === candidate.length && timingSafeEqual(original, candidate);
}

function serializeUser(user: { id: string; name: string; email: string; role: string }): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as UserRole
  };
}

function parseCookies(req: Request) {
  return Object.fromEntries(
    (req.headers.cookie ?? "")
      .split(";")
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const index = cookie.indexOf("=");
        return [cookie.slice(0, index), decodeURIComponent(cookie.slice(index + 1))];
      })
  );
}

export async function authenticate(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(password, user.passwordHash)) return null;
  return serializeUser(user);
}

export function createSession(res: Response, userId: string) {
  const token = randomUUID();
  sessions.set(token, userId);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 8,
    path: "/"
  });
}

export function clearSession(req: Request, res: Response) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) sessions.delete(token);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

export async function getSessionUser(req: Request) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const userId = sessions.get(token);
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user ? serializeUser(user) : null;
}
