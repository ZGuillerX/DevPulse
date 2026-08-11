import { z } from "zod";

export const connectGithubSchema = z.object({
  token: z.string().min(20, "El token parece demasiado corto para ser válido."),
});
