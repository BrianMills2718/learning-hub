import { DatabaseSync } from "node:sqlite";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const dataRoot = resolve(process.env.LEARNING_HUB_DATA_ROOT ?? join(process.env.HOME ?? ".", "Library", "Application Support", "learning-hub"));
const packageRoot = process.env.LEARNING_ENVIRONMENT_PACKAGE;
const python = process.env.LEARNING_HUB_WORKER_PYTHON;
if (!packageRoot || !python) throw new Error("LEARNING_ENVIRONMENT_PACKAGE and LEARNING_HUB_WORKER_PYTHON are required.");
mkdirSync(join(dataRoot, "artifacts"), { recursive: true });
const db = new DatabaseSync(join(dataRoot, "learning-hub.sqlite"));
const claim = db.prepare("UPDATE briefs SET status = 'generating', claimed_at = ? WHERE id = ? AND status = 'queued'");
const next = db.prepare("SELECT * FROM briefs WHERE status = 'queued' ORDER BY created_at LIMIT 1");
const finish = db.prepare("UPDATE briefs SET status = ?, completed_at = ?, failure_message = ?, artifact_path = ?, report_path = ? WHERE id = ?");

function slug(value) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "environment"; }
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
  const id = `generated-${brief.id}`;
  const request = { schemaVersion: "0.2.0", id, curriculum: { id: slug(brief.title), version: "0.1.0", title: brief.title, language: "en" }, goal: { id: `${slug(brief.title)}-goal`, title: brief.outcome, description: brief.outcome, kind: "capability" }, audience: { description: `${brief.level} learners`, assumedKnowledge: [], level: brief.level }, scope: { requiredTopics: [brief.topic, brief.scope], optionalTopics: [], excludedTopics: [] }, assurance: { mode: sources.length ? "source-grounded" : "model-inherent", asOf: new Date().toISOString().slice(0, 10) }, sources, constraints: [brief.sources, brief.scope] };
  const agent = new LlmClientCurriculumAgent({ model: "openrouter/deepseek/deepseek-v4-flash", maxBudget: 1, task: "learning_hub_generation", traceIdPrefix: `learning-hub/${brief.id}`, pythonExecutable: python, environment: process.env, reasoningEffort: "none", maxRetries: 1, maxRevisionPasses: 2 });
  const result = await generateCurriculum({ request, policy: baselineCurriculumGenerationPolicy({ id: "learning-hub-baseline", version: "1.0.0", maxAttempts: 2 }), agent });
  const output = join(dataRoot, "artifacts", brief.id);
  mkdirSync(output, { recursive: true });
  const reportPath = join(output, "report.json");
  writeFileSync(reportPath, `${JSON.stringify(result.report, null, 2)}\n`);
  const artifactPath = result.curriculum ? join(output, "curriculum.json") : null;
  if (result.curriculum) writeFileSync(artifactPath, `${JSON.stringify(result.curriculum, null, 2)}\n`);
  finish.run(result.status === "accepted" ? "generated" : "failed", new Date().toISOString(), result.status === "accepted" ? null : `Generation ended ${result.status}.`, artifactPath, reportPath, brief.id);
} catch (error) {
  finish.run("failed", new Date().toISOString(), error instanceof Error ? error.message.slice(0, 2000) : "Worker failure.", null, null, brief.id);
  throw error;
}
