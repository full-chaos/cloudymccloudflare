import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { app } from "./index";

// Serve static SPA files
app.use("/*", serveStatic({ root: "./dist/client" }));

const port = Number(process.env.PORT || 8787);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`CloudlyMcCloudFlare running on http://localhost:${info.port}`);
});
