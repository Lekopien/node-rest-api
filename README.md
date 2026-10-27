# Node REST API

[![ci](https://github.com/Lekopien/node-rest-api/actions/workflows/ci.yml/badge.svg)](https://github.com/Lekopien/node-rest-api/actions/workflows/ci.yml)

**Project page: https://api.lekopien.com**

A production-style REST API for managing client projects, built with **Express 5** and plain Node.js. It shows the things a real API needs beyond CRUD: input validation, consistent JSON errors, filtering and pagination, rate limiting, API-key auth, request IDs, logging, atomic file persistence, graceful shutdown, Docker and an automated test suite.

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | Liveness check |
| GET | `/api/projects` | List with `status`, `tag`, `q`, `sort`, `page`, `limit` |
| GET | `/api/projects/:id` | Fetch one |
| POST | `/api/projects` | Create (`name`, `client` required; `status`, `budget`, `tags` optional) |
| PATCH | `/api/projects/:id` | Partial update |
| DELETE | `/api/projects/:id` | Delete |
| GET | `/api/stats` | Totals by status and total budget |

`sort` accepts `name`, `client`, `budget`, `createdAt`, `updatedAt`; prefix with `-` for descending.

## Quick start

```bash
npm install
npm start                       # http://localhost:3000
npm test                        # node:test + supertest
```

```bash
curl -X POST localhost:3000/api/projects \
  -H 'content-type: application/json' \
  -d '{"name":"Bakery website","client":"Mama'\''s Bakery","budget":450,"tags":["web"]}'

curl 'localhost:3000/api/projects?status=planned&sort=-budget&limit=5'
```

Errors always have the same shape:

```json
{ "error": { "status": 422, "message": "Validation failed",
             "details": { "name": "is required" }, "requestId": "…" } }
```

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Port to listen on |
| `DB_FILE` | `data/db.json` | Where records are stored |
| `API_KEY` | *(unset)* | When set, POST/PATCH/DELETE need `Authorization: Bearer <key>` |

## Docker

```bash
docker build -t node-rest-api .
docker run -p 3000:3000 -v $PWD/data:/app/data node-rest-api
```

## Project layout

```
src/
  app.js         routes, wired as a factory so tests get a fresh app
  middleware.js  request id, logger, rate limiter, auth, error handler
  validate.js    schema validation with per-field messages
  query.js       filtering, search, sorting, pagination
  store.js       in-memory store with atomic JSON file persistence
  server.js      starts the HTTP server and handles shutdown
test/api.test.js 11 integration tests
site/            project page served at api.lekopien.com
```

## License

MIT
