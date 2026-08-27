import "dotenv/config";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import Fastify from "fastify";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appRouter } from "./routers";
import { sdk } from "./_core/sdk";
import type { User } from "../drizzle/schema";
import { processHostingerMailWebhook } from "./services/hostingerWebhook";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const staticRoot = path.resolve(currentDir, "public");

async function createFastifyContext({ req, res }: { req: { raw: unknown }; res: { raw: unknown } }) {
  let user: User | null = null;
  try {
    user = await sdk.authenticateRequest(req.raw as Parameters<typeof sdk.authenticateRequest>[0]);
  } catch {
    user = null;
  }
  return { req: req.raw, res: res.raw, user } as never;
}

async function start() {
  const app = Fastify({ logger: true, bodyLimit: 6 * 1024 * 1024 });
  await app.register(cors, { origin: process.env.APP_BASE_URL ?? false, credentials: true });
  await app.register(fastifyTRPCPlugin, {
    prefix: "/api/trpc",
    trpcOptions: { router: appRouter, createContext: createFastifyContext },
  });
  app.post("/api/webhooks/hostinger-mail", async (request, reply) => {
    const authorization = typeof request.headers.authorization === "string" ? request.headers.authorization : undefined;
    const result = await processHostingerMailWebhook({ authorization, body: request.body });
    return reply.status(result.statusCode).send(result.body);
  });
  app.get("/api/health", async () => ({ status: "ok", service: "freelancehr", now: new Date().toISOString() }));
  await app.register(fastifyStatic, { root: staticRoot, wildcard: false });
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith("/api/")) return reply.status(404).send({ error: "Not found" });
    return reply.type("text/html").sendFile("index.html");
  });
  const port = Number(process.env.PORT || 3000);
  await app.listen({ port, host: "0.0.0.0" });
}

start().catch(error => {
  console.error(error);
  process.exit(1);
});
