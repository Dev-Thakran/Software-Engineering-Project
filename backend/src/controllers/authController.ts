import type { Request, Response } from "express";

export const login = (req: Request, res: Response) => {
  const { username, password } = req.body;

  // Simple mock logic (easy to understand)
  if (username === "admin" && password === "123") {
    return res.json({ success: true, role: "admin" });
  }

  return res.status(401).json({ success: false });
};