import { z } from "zod";

const webEnvSchema = z.object({
	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default(import.meta.env.MODE === "production" ? "production" : "development"),
	SITE_URL: z.string().default("http://localhost:5173"),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

export const webEnv = webEnvSchema.parse({
	NODE_ENV: import.meta.env.MODE === "production" ? "production" : "development",
	SITE_URL: import.meta.env.VITE_SITE_URL ?? "http://localhost:5173",
});
