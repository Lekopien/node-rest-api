import { createApp } from "./app.js";
import { Store } from "./store.js";

const port = Number(process.env.PORT ?? 3000);
const store = await new Store(process.env.DB_FILE ?? "data/db.json").load();
const app = createApp({ store });

const server = app.listen(port, () => console.log(`API listening on http://localhost:${port}`));

// Finish in-flight requests before exiting (e.g. on `docker stop`).
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
