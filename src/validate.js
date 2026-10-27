export const STATUSES = ["planned", "active", "done"];

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const rules = {
  name: (v) => (typeof v === "string" && v.trim().length >= 2 && v.length <= 120) || "must be a string of 2-120 characters",
  client: (v) => (typeof v === "string" && v.trim().length >= 1 && v.length <= 120) || "must be a non-empty string up to 120 characters",
  status: (v) => STATUSES.includes(v) || `must be one of ${STATUSES.join(", ")}`,
  budget: (v) => (Number.isFinite(v) && v >= 0) || "must be a number ≥ 0",
  tags: (v) => (Array.isArray(v) && v.length <= 10 && v.every((t) => typeof t === "string" && t.length <= 30)) || "must be an array of up to 10 short strings",
};

const REQUIRED = ["name", "client"];

/** Validates a project body. `partial` is for PATCH, where every field is optional. */
export function validateProject(body, { partial = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Body must be a JSON object");
  }
  const errors = {};
  for (const key of Object.keys(body)) {
    if (!rules[key]) errors[key] = "unknown field";
  }
  for (const [key, check] of Object.entries(rules)) {
    if (body[key] === undefined) {
      if (!partial && REQUIRED.includes(key)) errors[key] = "is required";
      continue;
    }
    const ok = check(body[key]);
    if (ok !== true) errors[key] = ok;
  }
  if (Object.keys(errors).length) throw new HttpError(422, "Validation failed", errors);

  const clean = {};
  for (const key of Object.keys(rules)) if (body[key] !== undefined) clean[key] = typeof body[key] === "string" ? body[key].trim() : body[key];
  if (!partial) clean.status ??= "planned";
  if (!partial) clean.tags ??= [];
  if (!partial) clean.budget ??= 0;
  return clean;
}
