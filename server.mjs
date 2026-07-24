import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, statSync } from "node:fs";
import { resolve, extname, join, relative } from "node:path";

const HOST = process.env.LEARNING_HUB_HOST ?? "127.0.0.1";
const PORT = Number(process.env.LEARNING_HUB_PORT ?? "8780");
const SITE_ROOT = resolve(process.env.LEARNING_HUB_SITE_ROOT ?? process.cwd());
const DATA_ROOT = resolve(process.env.LEARNING_HUB_DATA_ROOT ?? join(process.env.HOME ?? ".", "Library", "Application Support", "learning-hub"));
const USERNAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9 _-]{0,30}$/;
const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".ico", "image/x-icon"],
]);

mkdirSync(DATA_ROOT, { recursive: true });
const database = new DatabaseSync(join(DATA_ROOT, "learning-hub.sqlite"));
database.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS profiles (
    username TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS briefs (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    created_at TEXT NOT NULL,
    title TEXT NOT NULL,
    topic TEXT NOT NULL,
    level TEXT NOT NULL,
    visibility TEXT NOT NULL,
    outcome TEXT NOT NULL,
    sources TEXT NOT NULL,
    scope TEXT NOT NULL,
    research_enabled INTEGER NOT NULL,
    status TEXT NOT NULL,
    FOREIGN KEY(username) REFERENCES profiles(username)
  );
  CREATE INDEX IF NOT EXISTS briefs_by_username_created_at ON briefs(username, created_at DESC);
`);

const selectProfile = database.prepare(`
  SELECT profile.username, profile.created_at, profile.last_seen_at, COUNT(brief.id) AS brief_count
  FROM profiles profile
  LEFT JOIN briefs brief ON brief.username = profile.username
  WHERE profile.username = ?
  GROUP BY profile.username
`);
const upsertProfile = database.prepare(`
  INSERT INTO profiles (username, created_at, last_seen_at) VALUES (?, ?, ?)
  ON CONFLICT(username) DO UPDATE SET last_seen_at = excluded.last_seen_at
`);
const selectBriefs = database.prepare(`
  SELECT id, username, created_at, title, topic, level, visibility, outcome, sources, scope,
         research_enabled, status
  FROM briefs WHERE username = ? ORDER BY created_at DESC
`);
const insertBrief = database.prepare(`
  INSERT INTO briefs (
    id, username, created_at, title, topic, level, visibility, outcome, sources, scope,
    research_enabled, status
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const selectBrief = database.prepare(`
  SELECT id, username, created_at, title, topic, level, visibility, outcome, sources, scope,
         research_enabled, status
  FROM briefs WHERE id = ?
`);

function json(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(`${JSON.stringify(body)}\n`);
}

function text(response, status, body) {
  response.writeHead(status, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
  response.end(body);
}

function normalizeUsername(value) {
  const username = typeof value === "string" ? value.trim() : "";
  if (!USERNAME_PATTERN.test(username)) {
    throw new Error("Names must be 1-31 characters and use letters, numbers, spaces, hyphens, or underscores.");
  }
  return username;
}

function requiredText(value, field, maximum) {
  const textValue = typeof value === "string" ? value.trim() : "";
  if (!textValue || textValue.length > maximum) throw new Error(`${field} is required and must be at most ${maximum} characters.`);
  return textValue;
}

function profileResponse(username) {
  const profile = selectProfile.get(username);
  if (!profile) return { exists: false, username };
  return {
    exists: true,
    username: profile.username,
    createdAt: profile.created_at,
    lastSeenAt: profile.last_seen_at,
    briefCount: Number(profile.brief_count),
  };
}

function briefResponse(brief) {
  return {
    id: brief.id,
    username: brief.username,
    createdAt: brief.created_at,
    title: brief.title,
    topic: brief.topic,
    level: brief.level,
    visibility: brief.visibility,
    outcome: brief.outcome,
    sources: brief.sources,
    scope: brief.scope,
    researchEnabled: Boolean(brief.research_enabled),
    status: brief.status,
  };
}

async function readBody(request) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 32_000) throw new Error("Request body exceeds 32 KB.");
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

function serveStatic(pathname, response) {
  const requestedPath = pathname === "/" ? "index.html" : pathname.slice(1);
  let filePath = resolve(SITE_ROOT, requestedPath);
  if (relative(SITE_ROOT, filePath).startsWith("..")) return text(response, 403, "Forbidden");
  try {
    if (statSync(filePath).isDirectory()) filePath = join(filePath, "index.html");
    if (!statSync(filePath).isFile()) return text(response, 404, "Not found");
    response.writeHead(200, {
      "content-type": MIME_TYPES.get(extname(filePath)) ?? "application/octet-stream",
      "cache-control": "no-cache",
    });
    response.end(readFileSync(filePath));
  } catch (error) {
    if (error?.code === "ENOENT") return text(response, 404, "Not found");
    console.error(error);
    return text(response, 500, "Unable to read the requested file.");
  }
}

async function handleApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/health") {
    return json(response, 200, { status: "ok", service: "learning-hub" });
  }

  const profileMatch = url.pathname.match(/^\/api\/profiles\/([^/]+)$/);
  if (profileMatch) {
    const username = normalizeUsername(decodeURIComponent(profileMatch[1]));
    if (request.method === "GET") return json(response, 200, profileResponse(username));
    if (request.method === "PUT") {
      const before = profileResponse(username);
      const now = new Date().toISOString();
      upsertProfile.run(username, now, now);
      return json(response, before.exists ? 200 : 201, { ...profileResponse(username), shared: before.exists });
    }
  }

  const briefsMatch = url.pathname.match(/^\/api\/profiles\/([^/]+)\/briefs$/);
  if (request.method === "GET" && briefsMatch) {
    const username = normalizeUsername(decodeURIComponent(briefsMatch[1]));
    return json(response, 200, { briefs: selectBriefs.all(username).map(briefResponse) });
  }

  const briefMatch = url.pathname.match(/^\/api\/briefs\/([a-f0-9-]+)$/);
  if (request.method === "GET" && briefMatch) {
    const brief = selectBrief.get(briefMatch[1]);
    return brief ? json(response, 200, { brief: briefResponse(brief) }) : json(response, 404, { error: "Brief not found." });
  }

  if (request.method === "POST" && url.pathname === "/api/briefs") {
    const input = await readBody(request);
    const username = normalizeUsername(input.username);
    const researchEnabled = input.researchEnabled === true;
    if (typeof input.researchEnabled !== "boolean") throw new Error("Research choice is required.");
    const level = requiredText(input.level, "Starting level", 40);
    const visibility = requiredText(input.visibility, "Visibility", 40);
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    upsertProfile.run(username, now, now);
    insertBrief.run(
      id,
      username,
      now,
      requiredText(input.title, "Title", 80),
      requiredText(input.topic, "Topic", 160),
      level,
      visibility,
      requiredText(input.outcome, "Outcome", 3_000),
      requiredText(input.sources, "Source material", 5_000),
      requiredText(input.scope, "Scope", 3_000),
      researchEnabled ? 1 : 0,
      "queued",
    );
    return json(response, 201, { brief: briefResponse(selectBrief.get(id)) });
  }

  return json(response, 404, { error: "API route not found." });
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? HOST}`);
  try {
    if (url.pathname.startsWith("/api/")) return await handleApi(request, response, url);
    return serveStatic(url.pathname, response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    const status = /required|must be|exceeds|valid JSON|Names/.test(message) ? 400 : 500;
    if (status === 500) console.error(error);
    return json(response, status, { error: message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Learning Hub listening on http://${HOST}:${PORT}`);
});
