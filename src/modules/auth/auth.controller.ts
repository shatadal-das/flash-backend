import { Request, Response } from "express";
import * as authService from "./auth.service";

export async function handleRegister(req: Request, res: Response) {
  const data = await authService.register(req.body);
  res.status(201).json({ success: true, data });
}

export async function handleLogin(req: Request, res: Response) {
  const data = await authService.login(req.body);
  res.status(200).json({ success: true, data });
}

export async function handleRefresh(req: Request, res: Response) {
  const data = await authService.refresh(req.body);
  res.status(200).json({ success: true, data });
}

export async function handleLogout(req: Request, res: Response) {
  if (req.user) {
    await authService.logout(req.user.userId);
  }
  res.status(200).json({ success: true, message: "Logged out successfully" });
}

export function handleRoleAccess(role: string) {
  return (_req: Request, res: Response) => {
    res.json({ success: true, message: `Welcome, ${role}!` });
  };
}

