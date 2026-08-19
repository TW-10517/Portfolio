import { Router } from "express";
import { db } from "../db.js";
import { validateRegistration, validateLogin, hashPassword, verifyPassword, signToken, requireAuth } from "../auth.js";

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const { name, email, password } = req.body || {};
  const errors = validateRegistration({ name, email, password });
  if (Object.keys(errors).length) return res.status(400).json({ errors });

  const normalizedEmail = email.trim().toLowerCase();
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(normalizedEmail);
  if (existing) return res.status(409).json({ errors: { email: "An account with this email already exists." } });

  const password_hash = await hashPassword(password);
  const info = db
    .prepare("INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)")
    .run(normalizedEmail, password_hash, name.trim());

  const user = { id: info.lastInsertRowid, email: normalizedEmail, name: name.trim() };
  const token = signToken(user);
  res.status(201).json({ token, user });
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  const errors = validateLogin({ email, password });
  if (Object.keys(errors).length) return res.status(400).json({ errors });

  const normalizedEmail = email.trim().toLowerCase();
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(normalizedEmail);
  const genericError = { errors: { form: "Incorrect email or password." } };
  if (!row) return res.status(401).json(genericError);

  const valid = await verifyPassword(password, row.password_hash);
  if (!valid) return res.status(401).json(genericError);

  const user = { id: row.id, email: row.email, name: row.name };
  const token = signToken(user);
  res.json({ token, user });
});

authRouter.get("/me", requireAuth, (req, res) => {
  const row = db.prepare("SELECT id, email, name, created_at FROM users WHERE id = ?").get(req.user.sub);
  if (!row) return res.status(404).json({ error: "User not found." });
  res.json({ user: row });
});
