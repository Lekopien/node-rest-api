import express from "express";
import { errorHandler, logger, notFound, rateLimit, requestId, requireKey } from "./middleware.js";
import { listQuery } from "./query.js";
import { Store } from "./store.js";
import { HttpError, validateProject } from "./validate.js";

export function createApp({ store = new Store(), apiKey = process.env.API_KEY, silent = false, rate = {} } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(requestId, logger({ silent }), rateLimit(rate), express.json({ limit: "100kb" }));

  app.get("/health", (req, res) => res.json({ status: "ok", uptime: process.uptime() }));

  const api = express.Router();
  api.use(requireKey(apiKey));

  const find = (id) => {
    const item = store.get(id);
    if (!item) throw new HttpError(404, `Project ${id} not found`);
    return item;
  };

  api.get("/projects", (req, res) => res.json(listQuery(store.all(), req.query)));
  api.get("/projects/:id", (req, res) => res.json({ data: find(req.params.id) }));
  api.post("/projects", async (req, res) => {
    const item = await store.create(validateProject(req.body));
    res.status(201).location(`/api/projects/${item.id}`).json({ data: item });
  });
  api.patch("/projects/:id", async (req, res) => {
    find(req.params.id);
    res.json({ data: await store.update(req.params.id, validateProject(req.body, { partial: true })) });
  });
  api.delete("/projects/:id", async (req, res) => {
    find(req.params.id);
    await store.remove(req.params.id);
    res.status(204).end();
  });
  api.get("/stats", (req, res) => {
    const all = store.all();
    const byStatus = Object.fromEntries(["planned", "active", "done"].map((s) => [s, all.filter((p) => p.status === s).length]));
    res.json({ data: { total: all.length, byStatus, totalBudget: all.reduce((sum, p) => sum + p.budget, 0) } });
  });

  app.use("/api", api);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
