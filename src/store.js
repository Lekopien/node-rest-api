import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * A tiny document store. Keeps records in memory and, when given a file path,
 * persists them with an atomic write (temp file + rename) after every change.
 */
export class Store {
  constructor(file = null) {
    this.file = file;
    this.items = new Map();
  }

  async load() {
    if (!this.file) return this;
    try {
      for (const item of JSON.parse(await readFile(this.file, "utf8"))) this.items.set(item.id, item);
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }
    return this;
  }

  async #save() {
    if (!this.file) return;
    await mkdir(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify([...this.items.values()], null, 2));
    await rename(tmp, this.file);
  }

  all() {
    return [...this.items.values()];
  }

  get(id) {
    return this.items.get(id) ?? null;
  }

  async create(data) {
    const now = new Date().toISOString();
    const item = { id: randomUUID(), ...data, createdAt: now, updatedAt: now };
    this.items.set(item.id, item);
    await this.#save();
    return item;
  }

  async update(id, patch) {
    const current = this.items.get(id);
    if (!current) return null;
    const item = { ...current, ...patch, id, updatedAt: new Date().toISOString() };
    this.items.set(id, item);
    await this.#save();
    return item;
  }

  async remove(id) {
    const existed = this.items.delete(id);
    if (existed) await this.#save();
    return existed;
  }
}
