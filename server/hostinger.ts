import "dotenv/config";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import Fastify from "fastify";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appRouter } from "./routers";
import type { User } from "../drizzle/schema";
import { processHostingerMailWebhook } from "./services/hostingerWebhook";
import { assertProductionRuntimeConfiguration, authenticateRuntimeRequest, beginOidcLogin, completeOidcLogin, isOidcRuntime } from "./services/runtimeAuth";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const staticRoot = path.resolve(currentDir, "public");

async function createFastifyContext({ req, res }: { req: { raw: unknown }; res: { raw: unknown } }) {
  const user: User | null = await authenticateRuntimeRequest(req.raw as { headers?: { cookie?: string } });
  return { req: req.raw, res: res.raw, user, actor: user, workspace: null } as never;
}

async function start() {
  assertProductionRuntimeConfiguration();
  const app = Fastify({ logger: true, bodyLimit: 6 * 1024 * 1024 });
  await app.register(cors, { origin: process.env.APP_BASE_URL ?? false, credentials: true });
  await app.register(fastifyTRPCPlugin, {
    prefix: "/api/trpc",
    trpcOptions: { router: appRouter, createContext: createFastifyContext },
  });
  if (isOidcRuntime()) {
    app.get("/api/auth/oidc/login", async (_request, reply) => {
      try { const login = await beginOidcLogin(); reply.header("Set-Cookie", login.stateCookie); return reply.redirect(login.redirectUrl); }
      catch { return reply.status(503).send({ error: "OIDC sign-in is not configured." }); }
    });
    app.get("/api/auth/oidc/callback", async (request, reply) => {
      try {
        const query = request.query as { code?: string; state?: string };
        const completed = await completeOidcLogin({ code: query.code, state: query.state, cookieHeader: request.headers.cookie });
        reply.header("Set-Cookie", [completed.sessionCookie, completed.clearStateCookie]);
        return reply.redirect("/");
      } catch { return reply.status(403).send({ error: "OIDC sign-in could not be completed." }); }
    });
  }
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
