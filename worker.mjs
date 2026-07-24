import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const dataRoot = resolve(process.env.LEARNING_HUB_DATA_ROOT ?? join(process.env.HOME ?? ".", "Library", "Application Support", "learning-hub"));
const packageRoot = process.env.LEARNING_ENVIRONMENT_PACKAGE;
const python = process.env.LEARNING_HUB_WORKER_PYTHON;
const generationModel = process.env.LEARNING_HUB_GENERATION_MODEL ?? "openrouter/deepseek/deepseek-v4-flash";
if (!packageRoot || !python) throw new Error("LEARNING_ENVIRONMENT_PACKAGE and LEARNING_HUB_WORKER_PYTHON are required.");
mkdirSync(join(dataRoot, "artifacts"), { recursive: true });
const db = new DatabaseSync(join(dataRoot, "learning-hub.sqlite"));
try {
  db.exec("ALTER TABLE briefs ADD COLUMN checkpoint_path TEXT");
} catch (error) {
  if (!String(error).includes("duplicate column name")) throw error;
}
const claim = db.prepare("UPDATE briefs SET status = 'generating', claimed_at = ? WHERE id = ? AND status = 'queued'");
const next = db.prepare("SELECT * FROM briefs WHERE status = 'queued' ORDER BY created_at LIMIT 1");
const finish = db.prepare("UPDATE briefs SET status = ?, completed_at = ?, failure_message = ?, artifact_path = ?, report_path = ?, checkpoint_path = ? WHERE id = ?");

function slug(value) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "environment"; }
function errorDetail(error) {
  if (!(error instanceof Error)) return "Worker failure.";
  const cause = error.cause instanceof Error ? ` Cause: ${error.cause.message}` : "";
  return `${error.message}${cause}`.slice(0, 2_000);
}
function research(brief) {
  if (!brief.research_enabled) return [];
  const script = `import json,os\nfrom open_web_retrieval.client import OpenWebRetrievalClient\nfrom open_web_retrieval.models import SearchQuery\nfrom datetime import datetime,timezone\nwith OpenWebRetrievalClient(tavily_api_key=os.environ['TAVILY_API_KEY']) as c:\n hits=c.search(SearchQuery(query=${JSON.stringify(`${brief.topic} ${brief.sources}`)},providers=['tavily'],top_k=5,search_depth='basic'))\nprint(json.dumps([{'id':'web-'+str(i+1),'kind':'website','title':h.title or h.url,'locator':h.url,'authors':[],'accessedAt':datetime.now(timezone.utc).isoformat().replace('+00:00','Z'),'content':h.snippet or h.title or h.url} for i,h in enumerate(hits)]))`;
  const result = spawnSync(python, ["-c", script], { encoding: "utf8", env: process.env });
  if (result.status !== 0) throw new Error(`Retrieval failed: ${result.stderr.trim()}`);
  return JSON.parse(result.stdout);
}

const brief = next.get();
if (!brief) process.exit(0);
if (claim.run(new Date().toISOString(), brief.id).changes !== 1) process.exit(0);
try {
  const sources = research(brief).map((source) => ({ ...source }));
  const cryptoModule = await import("node:crypto");
  for (const source of sources) source.contentHash = `sha256:${cryptoModule.createHash("sha256").update(source.content).digest("hex")}`;
  const { baselineCurriculumGenerationPolicy, generateCurriculum } = await import(join(packageRoot, "dist/generator.js"));
  const { LlmClientCurriculumAgent } = await import(join(packageRoot, "dist/generators/llm-client.js"));
  const { planCurriculum } = await import(join(packageRoot, "dist/planner.js"));
  const { renderCurriculumPlanHtml } = await import(join(packageRoot, "dist/reference-renderer.js"));
  const id = `generated-${brief.id}`;
  const request = { schemaVersion: "0.2.0", id, curriculum: { id: slug(brief.title), version: "0.1.0", title: brief.title, language: "en" }, goal: { id: `${slug(brief.title)}-goal`, title: brief.outcome, description: brief.outcome, kind: "capability" }, audience: { description: `${brief.level} learners`, assumedKnowledge: [], level: brief.level }, scope: { requiredTopics: [brief.topic, brief.scope], optionalTopics: [], excludedTopics: [] }, assurance: { mode: sources.length ? "source-grounded" : "model-inherent", asOf: new Date().toISOString().slice(0, 10) }, sources, constraints: [brief.sources, brief.scope] };
  const output = join(dataRoot, "artifacts", brief.id);
  mkdirSync(output, { recursive: true });
  const checkpointPath = join(output, "candidate-checkpoint.json");
  let checkpoint;
  try { checkpoint = JSON.parse(await (await import("node:fs/promises")).readFile(checkpointPath, "utf8")); } catch (error) { if (error?.code !== "ENOENT") throw error; }
  const liveAgent = new LlmClientCurriculumAgent({ model: generationModel, maxBudget: 1, task: "learning_hub_generation", traceIdPrefix: `learning-hub/${brief.id}`, pythonExecutable: python, environment: process.env, reasoningEffort: "none", maxRetries: 1, maxRevisionPasses: 2 });
  let usedCheckpoint = false;
  const agent = { descriptor: liveAgent.descriptor, async propose(nextRequest) { if (checkpoint && !usedCheckpoint) { usedCheckpoint = true; return checkpoint.candidate; } const candidate = await liveAgent.propose(nextRequest); writeFileSync(checkpointPath, `${JSON.stringify({ candidate, savedAt: new Date().toISOString() }, null, 2)}\n`); return candidate; }, async revise(revision) { const candidate = await liveAgent.revise(revision); writeFileSync(checkpointPath, `${JSON.stringify({ candidate, savedAt: new Date().toISOString() }, null, 2)}\n`); return candidate; } };
  const result = await generateCurriculum({ request, policy: baselineCurriculumGenerationPolicy({ id: "learning-hub-baseline", version: "1.0.0", maxAttempts: 3 }), agent });
  const reportPath = join(output, "report.json");
  writeFileSync(reportPath, `${JSON.stringify(result.report, null, 2)}\n`);
  const artifactPath = result.curriculum ? join(output, "curriculum.json") : null;
  if (result.curriculum) {
    writeFileSync(artifactPath, `${JSON.stringify(result.curriculum, null, 2)}\n`);
    const plan = planCurriculum(result.curriculum, { goalId: request.goal.id });
    writeFileSync(join(output, "index.html"), renderCurriculumPlanHtml(result.curriculum, plan, { title: brief.title }));
  }
  finish.run(result.status === "accepted" ? "generated" : "failed", new Date().toISOString(), result.status === "accepted" ? null : `Generation ended ${result.status}; private checkpoint retained for continuation.`, artifactPath, reportPath, existsSync(checkpointPath) ? checkpointPath : null, brief.id);
} catch (error) {
  const output = join(dataRoot, "artifacts", brief.id);
  const checkpointPath = join(output, "candidate-checkpoint.json");
  finish.run("failed", new Date().toISOString(), errorDetail(error), null, join(output, "report.json"), existsSync(checkpointPath) ? checkpointPath : null, brief.id);
  throw error;
}
