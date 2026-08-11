import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("Correo inválido"),
  password: z
    .string()
    .min(9, "La contraseña debe tener más de 8 caracteres")
    .regex(/[A-Z]/, "La contraseña debe tener al menos una mayúscula")
    .regex(/[0-9]/, "La contraseña debe tener al menos un número"),
  name: z.string().min(1).max(255).optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
});
