import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  name: z.string().min(1).max(255).optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
});
