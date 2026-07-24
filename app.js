const ENVIRONMENTS = [
  { id: "second-brain", title: "Second Brain", description: "Knowledge graphs, ontologies, retrieval, and verification.", href: "../second-brain/#/tree" },
  { id: "learning-map", title: "Learning Map", description: "Build a quality-gated learning map from goal to capability.", href: "../learning-map/#/tree" },
  { id: "godel", title: "Godel", description: "Formal systems and the prerequisites for incompleteness.", href: "../godel/#/tree" },
  { id: "category", title: "Category Theory", description: "Objects, morphisms, composition, and structural reasoning.", href: "../category/#/tree" },
  { id: "claude", title: "Claude Code", description: "Project configuration, skills, agents, hooks, MCP, and team workflows.", href: "../claude/#/tree" },
];

const PROFILE_KEY = "learning-hub:profile:v1";
const DRAFTS_KEY = "learning-hub:drafts:v1";
const SUMMARY_KEY = (environmentId) => `learning-hub:progress:${environmentId}:v1`;
const app = document.querySelector("#app");
const profileForm = document.querySelector("[data-profile-form]");
const username = profileForm.elements.username;
const dialog = document.querySelector("[data-draft-dialog]");

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "");
    return value ?? fallback;
  } catch (_) {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function profile() {
  const value = readJson(PROFILE_KEY, {});
  return typeof value.username === "string" ? value : {};
}

function drafts() {
  const value = readJson(DRAFTS_KEY, []);
  return Array.isArray(value) ? value : [];
}

function summary(environmentId) {
  const value = readJson(SUMMARY_KEY(environmentId), null);
  if (!value || value.schemaVersion !== "1") return null;
  return value;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
}

function progressFor(environment) {
  const value = summary(environment.id);
  const completed = Array.isArray(value?.completedNodeIds) ? value.completedNodeIds.length : 0;
  if (completed === 0) return { completed, label: "Not started", state: "empty" };
  return { completed, label: `${completed} completed`, state: "in-progress" };
}

function renderDashboard() {
  const currentProfile = profile();
  username.value = currentProfile.username || "";
  const progress = ENVIRONMENTS.map((environment) => ({ environment, progress: progressFor(environment) }));
  const activeCount = progress.filter((item) => item.progress.completed > 0).length;
  const achievementPercent = Math.round((activeCount / ENVIRONMENTS.length) * 100);
  const currentDrafts = drafts();
  app.innerHTML = `<div class="workspace">
    <p class="eyebrow">${currentProfile.username ? `Workspace for ${escapeHtml(currentProfile.username)}` : "Local workspace"}</p>
    <h1>Learning environments</h1>
    <p class="lede">Choose an environment, continue a goal, or define a new environment as a structured draft.</p>
    <div class="dashboard-grid">
      <section aria-labelledby="environments-heading">
        <div class="section-heading"><h2 id="environments-heading">Environments</h2><span>${ENVIRONMENTS.length} available</span></div>
        <ul class="environment-list">${progress.map(({ environment, progress: item }) => `<li class="environment-row"><div><h3>${escapeHtml(environment.title)}</h3><p>${escapeHtml(environment.description)}</p></div><div class="environment-meta"><span class="status ${item.state}">${item.label}</span><a class="button secondary" href="${environment.href}">Open</a></div></li>`).join("")}</ul>
        <section class="creator" aria-labelledby="creator-heading"><h2 id="creator-heading">New environment</h2>
          <form data-draft-form>
            <label>Title<input name="title" maxlength="80" required></label>
            <label>Topic<input name="topic" maxlength="160" required></label>
            <div class="two-col"><label>Starting level<select name="level"><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label><label>Visibility<select name="visibility"><option value="private">Private draft</option><option value="unlisted">Unlisted draft</option><option value="publishable">Review for publishing</option></select></label></div>
            <label>Outcome<textarea name="outcome" required></textarea></label>
            <label>Source material or source requirements<textarea name="sources" required></textarea></label>
            <label>Scope and time budget<textarea name="scope" required></textarea></label>
            <div class="form-actions"><button type="submit">Create draft</button><p class="creation-note">Drafts stay in this browser until submitted to a generation service.</p></div>
          </form>
        </section>
      </section>
      <aside>
        <section class="achievement" aria-labelledby="achievement-heading"><h2 id="achievement-heading">Cross-environment explorer</h2><p>Make progress across your learning environments.</p><div class="meter" aria-label="${activeCount} of ${ENVIRONMENTS.length} environments started"><span style="width:${achievementPercent}%"></span></div><p>${activeCount} of ${ENVIRONMENTS.length} environments started</p></section>
        <section aria-labelledby="drafts-heading"><div class="section-heading"><h2 id="drafts-heading">Your drafts</h2><span>${currentDrafts.length}</span></div>${currentDrafts.length ? `<ul class="draft-list">${currentDrafts.map((draft) => `<li class="draft-row"><div><h3>${escapeHtml(draft.title)}</h3><p>${escapeHtml(draft.topic)} - ${escapeHtml(draft.level)} - ${escapeHtml(draft.visibility)}</p></div><a class="button secondary" href="#/draft/${encodeURIComponent(draft.id)}">View</a></li>`).join("")}</ul>` : '<p class="empty">No drafts yet.</p>'}</section>
      </aside>
    </div>
  </div>`;
  document.querySelector("[data-draft-form]").addEventListener("submit", createDraft);
}

function createDraft(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const draft = {
    id: globalThis.crypto?.randomUUID?.() || String(Date.now()),
    createdAt: new Date().toISOString(),
    title: form.get("title").trim(),
    topic: form.get("topic").trim(),
    level: form.get("level"),
    visibility: form.get("visibility"),
    outcome: form.get("outcome").trim(),
    sources: form.get("sources").trim(),
    scope: form.get("scope").trim(),
    status: "draft",
  };
  const next = [...drafts(), draft];
  writeJson(DRAFTS_KEY, next);
  location.hash = `#/draft/${encodeURIComponent(draft.id)}`;
}

function renderDraft(draftId) {
  const draft = drafts().find((item) => item.id === draftId);
  if (!draft) { location.hash = "#/"; return; }
  app.innerHTML = `<article class="draft-view"><a class="button secondary" href="#/">Back to workspace</a><header><p class="eyebrow">${escapeHtml(draft.visibility)} - ${escapeHtml(draft.status)}</p><h1>${escapeHtml(draft.title)}</h1><p class="lede">${escapeHtml(draft.topic)}</p></header><dl><dt>Starting level</dt><dd>${escapeHtml(draft.level)}</dd><dt>Outcome</dt><dd>${escapeHtml(draft.outcome)}</dd><dt>Sources</dt><dd>${escapeHtml(draft.sources)}</dd><dt>Scope</dt><dd>${escapeHtml(draft.scope)}</dd></dl><button type="button" data-export-draft>Export brief</button></article>`;
  document.querySelector("[data-export-draft]").addEventListener("click", () => showDraftExport(draft));
}

function showDraftExport(draft) {
  dialog.innerHTML = `<form method="dialog" class="dialog"><h2 id="draft-dialog-heading">Draft brief</h2><pre>${escapeHtml(JSON.stringify({ schemaVersion: "1", draft }, null, 2))}</pre><div class="actions"><button type="button" data-download>Download JSON</button><button type="submit" class="secondary">Close</button></div></form>`;
  dialog.querySelector("[data-download]").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ schemaVersion: "1", draft }, null, 2) + "\n"], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${draft.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "learning-environment"}-brief.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
  });
  dialog.showModal();
}

function render() {
  const match = location.hash.match(/^#\/draft\/([^/]+)$/);
  if (match) renderDraft(decodeURIComponent(match[1])); else renderDashboard();
}

profileForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = username.value.trim();
  if (value) writeJson(PROFILE_KEY, { username: value });
  else localStorage.removeItem(PROFILE_KEY);
  render();
});
window.addEventListener("hashchange", render);
window.addEventListener("storage", (event) => {
  if (event.key?.startsWith("learning-hub:")) render();
});
render();
