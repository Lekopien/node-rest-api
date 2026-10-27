import { HttpError } from "./validate.js";

const SORTABLE = ["name", "client", "budget", "createdAt", "updatedAt"];

/** Filtering, full-text search, sorting and pagination for list endpoints. */
export function listQuery(items, query) {
  let out = items;
  if (query.status) out = out.filter((p) => p.status === query.status);
  if (query.tag) out = out.filter((p) => p.tags.includes(query.tag));
  if (query.q) {
    const q = String(query.q).toLowerCase();
    out = out.filter((p) => p.name.toLowerCase().includes(q) || p.client.toLowerCase().includes(q));
  }

  const sort = query.sort ?? "-createdAt";
  const field = sort.replace(/^-/, "");
  if (!SORTABLE.includes(field)) throw new HttpError(400, `sort must be one of ${SORTABLE.join(", ")} (prefix with - for descending)`);
  const dir = sort.startsWith("-") ? -1 : 1;
  out = [...out].sort((a, b) => (a[field] > b[field] ? dir : a[field] < b[field] ? -dir : 0));

  const limit = Math.min(Math.max(parseInt(query.limit ?? "10", 10) || 10, 1), 100);
  const page = Math.max(parseInt(query.page ?? "1", 10) || 1, 1);
  const total = out.length;
  return {
    data: out.slice((page - 1) * limit, page * limit),
    meta: { total, page, limit, pages: Math.max(Math.ceil(total / limit), 1) },
  };
}
