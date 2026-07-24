import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dataRoot = await mkdtemp(join(tmpdir(), "learning-hub-check-"));
const port = 18_000 + Math.floor(Math.random() * 1_000);
const baseUrl = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ["server.mjs"], {
  cwd: root,
  env: { ...process.env, LEARNING_HUB_PORT: String(port), LEARNING_HUB_DATA_ROOT: dataRoot },
  stdio: ["ignore", "pipe", "pipe"],
});
let stderr = "";
child.stderr.on("data", (chunk) => { stderr += chunk; });

async function waitForHealth() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch (_) {
      // The process has not bound its port yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Server did not become healthy. ${stderr}`);
}

async function request(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  return { status: response.status, body: await response.json() };
}

try {
  await waitForHealth();
  const firstProfile = await request("/api/profiles/Test%20Learner", { method: "PUT" });
  if (firstProfile.status !== 201 || firstProfile.body.shared !== false) throw new Error("First profile claim did not create a new profile.");

  const sharedProfile = await request("/api/profiles/Test%20Learner", { method: "PUT" });
  if (sharedProfile.status !== 200 || sharedProfile.body.shared !== true) throw new Error("Existing profile did not report shared status.");

  const invalidProfile = await request("/api/profiles/%40invalid", { method: "PUT" });
  if (invalidProfile.status !== 400) throw new Error("Invalid profile name was accepted.");

  const brief = await request("/api/briefs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: "Test Learner",
      title: "Agentic Coding",
      topic: "Reliable coding agents",
      level: "intermediate",
      visibility: "unlisted",
      outcome: "Build a source-grounded coding agent.",
      sources: "Primary documentation and technical guidance.",
      scope: "Two weeks.",
      researchEnabled: true,
    }),
  });
  if (brief.status !== 201 || brief.body.brief.status !== "queued" || brief.body.brief.researchEnabled !== true) {
    throw new Error("Creation request did not persist its expected queue state.");
  }

  const listed = await request("/api/profiles/Test%20Learner/briefs");
  if (listed.status !== 200 || listed.body.briefs.length !== 1 || listed.body.briefs[0].id !== brief.body.brief.id) {
    throw new Error("Persisted creation request was not returned by the profile API.");
  }

  console.log("Learning Hub server contract checks passed.");
} finally {
  child.kill("SIGTERM");
  await new Promise((resolve) => child.once("exit", resolve));
  await rm(dataRoot, { recursive: true, force: true });
}
