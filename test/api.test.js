import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, it } from "node:test";
import request from "supertest";
import { createApp } from "../src/app.js";
import { Store } from "../src/store.js";

let app;
beforeEach(() => {
  app = createApp({ silent: true, apiKey: "" });
});

const make = (body) => request(app).post("/api/projects").send(body);

describe("projects API", () => {
  it("reports health", async () => {
    const res = await request(app).get("/health").expect(200);
    assert.equal(res.body.status, "ok");
  });

  it("creates a project with defaults and a Location header", async () => {
    const res = await make({ name: "Bakery site", client: "Mama's Bakery" }).expect(201);
    assert.equal(res.body.data.status, "planned");
    assert.deepEqual(res.body.data.tags, []);
    assert.equal(res.headers.location, `/api/projects/${res.body.data.id}`);
  });

  it("rejects invalid bodies with field errors", async () => {
    const res = await make({ name: "x", status: "lost", extra: 1 }).expect(422);
    assert.deepEqual(Object.keys(res.body.error.details).sort(), ["client", "extra", "name", "status"]);
  });

  it("rejects malformed JSON", async () => {
    await request(app).post("/api/projects").set("content-type", "application/json").send("{bad").expect(400);
  });

  it("reads, updates and deletes", async () => {
    const { body } = await make({ name: "Shop", client: "Kiosk", budget: 500 });
    const id = body.data.id;
    await request(app).get(`/api/projects/${id}`).expect(200);
    const patched = await request(app).patch(`/api/projects/${id}`).send({ status: "active" }).expect(200);
    assert.equal(patched.body.data.status, "active");
    assert.equal(patched.body.data.budget, 500);
    await request(app).delete(`/api/projects/${id}`).expect(204);
    await request(app).get(`/api/projects/${id}`).expect(404);
  });

  it("filters, searches, sorts and paginates", async () => {
    for (const [name, status, budget] of [["Alpha", "done", 300], ["Beta", "active", 100], ["Gamma", "active", 200]]) {
      await make({ name, client: "Acme", status, budget, tags: ["web"] });
    }
    let res = await request(app).get("/api/projects?status=active&sort=budget").expect(200);
    assert.deepEqual(res.body.data.map((p) => p.name), ["Beta", "Gamma"]);
    res = await request(app).get("/api/projects?q=alp").expect(200);
    assert.equal(res.body.data[0].name, "Alpha");
    res = await request(app).get("/api/projects?limit=2&page=2&sort=name").expect(200);
    assert.deepEqual(res.body.meta, { total: 3, page: 2, limit: 2, pages: 2 });
    await request(app).get("/api/projects?sort=password").expect(400);
  });

  it("summarises stats", async () => {
    await make({ name: "One", client: "A", budget: 100, status: "done" });
    await make({ name: "Two", client: "B", budget: 50 });
    const res = await request(app).get("/api/stats").expect(200);
    assert.deepEqual(res.body.data, { total: 2, byStatus: { planned: 1, active: 0, done: 1 }, totalBudget: 150 });
  });

  it("returns JSON 404s for unknown routes", async () => {
    const res = await request(app).get("/nope").expect(404);
    assert.equal(res.body.error.status, 404);
  });
});

describe("security", () => {
  it("requires the API key for writes when configured", async () => {
    const secured = createApp({ silent: true, apiKey: "s3cret" });
    await request(secured).post("/api/projects").send({ name: "No key", client: "X" }).expect(401);
    await request(secured).post("/api/projects").set("authorization", "Bearer s3cret").send({ name: "Key", client: "X" }).expect(201);
    await request(secured).get("/api/projects").expect(200);
  });

  it("rate limits per client", async () => {
    const limited = createApp({ silent: true, apiKey: "", rate: { max: 2 } });
    await request(limited).get("/health").expect(200);
    await request(limited).get("/health").expect(200);
    const res = await request(limited).get("/health").expect(429);
    assert.equal(res.headers["ratelimit-remaining"], "0");
  });
});

describe("store persistence", () => {
  it("writes to disk and loads back", async () => {
    const file = join(await mkdtemp(join(tmpdir(), "api-")), "db.json");
    const store = await new Store(file).load();
    await store.create({ name: "Saved", client: "Disk", status: "planned", budget: 0, tags: [] });
    assert.equal(JSON.parse(await readFile(file, "utf8")).length, 1);
    const reloaded = await new Store(file).load();
    assert.equal(reloaded.all()[0].name, "Saved");
  });
});
