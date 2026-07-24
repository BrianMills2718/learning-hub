const ENVIRONMENTS = [
  { id: "second-brain", title: "Second Brain", description: "Knowledge graphs, ontologies, retrieval, and verification.", href: "../second-brain/#/tree" },
  { id: "learning-map", title: "Learning Map", description: "Build a quality-gated learning map from goal to capability.", href: "../learning-map/#/tree" },
  { id: "godel", title: "Godel", description: "Formal systems and the prerequisites for incompleteness.", href: "../godel/#/tree" },
  { id: "category", title: "Category Theory", description: "Objects, morphisms, composition, and structural reasoning.", href: "../category/#/tree" },
  { id: "claude", title: "Claude Code", description: "Project configuration, skills, agents, hooks, MCP, and team workflows.", href: "../claude/#/tree" },
];

const PROFILE_KEY = "learning-hub:profile:v1";
const SUMMARY_KEY = (environmentId) => `learning-hub:progress:${environmentId}:v1`;
const app = document.querySelector("#app");
const profileForm = document.querySelector("[data-profile-form]");
const usernameInput = profileForm.elements.username;
const profileMessage = document.querySelector("[data-profile-message]");
const workspace = { username: null, profile: null, briefs: [], loading: false, error: null };

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

function localProfile() {
  const value = readJson(PROFILE_KEY, {});
  return typeof value.username === "string" ? value : {};
}

function summary(environmentId) {
  const value = readJson(SUMMARY_KEY(environmentId), null);
  if (!value || value.schemaVersion !== "1") return null;
  return value;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers ?? {}) },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "The server could not complete that request.");
  return payload;
}

function setProfileMessage(message, state = "") {
  profileMessage.textContent = message;
  profileMessage.dataset.state = state;
}

async function refreshWorkspace() {
  const username = localProfile().username;
  workspace.username = username || null;
  workspace.profile = null;
  workspace.briefs = [];
  workspace.error = null;
  if (!username) return;
  workspace.loading = true;
  render();
  try {
    const [profile, briefs] = await Promise.all([
      api(`/api/profiles/${encodeURIComponent(username)}`),
      api(`/api/profiles/${encodeURIComponent(username)}/briefs`),
    ]);
    workspace.profile = profile;
    workspace.briefs = briefs.briefs;
  } catch (error) {
    workspace.error = error instanceof Error ? error.message : "Could not load the shared profile.";
  } finally {
    workspace.loading = false;
    render();
  }
}

function progressFor(environment) {
  const value = summary(environment.id);
  const completed = Array.isArray(value?.completedNodeIds) ? value.completedNodeIds.length : 0;
  if (completed === 0) return { completed, label: "Not started", state: "empty" };
  return { completed, label: `${completed} completed`, state: "in-progress" };
}

function profileSummary() {
  if (!workspace.username) return "Choose a public name to create or view shared learning environments.";
  if (workspace.loading) return `Loading ${workspace.username}'s shared profile...`;
  if (workspace.error) return workspace.error;
  if (!workspace.profile?.exists) return `${workspace.username} has no shared profile yet.`;
  return `${workspace.profile.briefCount} creation request${workspace.profile.briefCount === 1 ? "" : "s"} on this shared profile.`;
}

function renderDashboard() {
  const currentProfile = localProfile();
  usernameInput.value = currentProfile.username || "";
  const progress = ENVIRONMENTS.map((environment) => ({ environment, progress: progressFor(environment) }));
  const activeCount = progress.filter((item) => item.progress.completed > 0).length;
  const achievementPercent = Math.round((activeCount / ENVIRONMENTS.length) * 100);
  const currentBriefs = workspace.briefs;
  app.innerHTML = `<div class="workspace">
    <p class="eyebrow">${currentProfile.username ? `Shared workspace for ${escapeHtml(currentProfile.username)}` : "Shared learning workspace"}</p>
    <h1>Learning environments</h1>
    <p class="lede">${escapeHtml(profileSummary())}</p>
    ${workspace.error ? `<p class="error" role="alert">${escapeHtml(workspace.error)}</p>` : ""}
    <div class="dashboard-grid">
      <section aria-labelledby="environments-heading">
        <div class="section-heading"><h2 id="environments-heading">Environments</h2><span>${ENVIRONMENTS.length} available</span></div>
        <ul class="environment-list">${progress.map(({ environment, progress: item }) => `<li class="environment-row"><div><h3>${escapeHtml(environment.title)}</h3><p>${escapeHtml(environment.description)}</p></div><div class="environment-meta"><span class="status ${item.state}">${item.label}</span><a class="button secondary" href="${environment.href}">Open</a></div></li>`).join("")}</ul>
        <section class="creator" aria-labelledby="creator-heading"><h2 id="creator-heading">New environment</h2>
          <form data-brief-form>
            <label>Title<input name="title" maxlength="80" required></label>
            <label>Topic<input name="topic" maxlength="160" required></label>
            <div class="two-col"><label>Starting level<select name="level"><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label><label>Visibility<select name="visibility"><option value="private">Private draft</option><option value="unlisted">Unlisted draft</option><option value="publishable">Review for publishing</option></select></label></div>
            <label>Outcome<textarea name="outcome" required></textarea></label>
            <label>Source material or source requirements<textarea name="sources" required></textarea></label>
            <label>Scope and time budget<textarea name="scope" required></textarea></label>
            <label class="research-choice"><input name="researchEnabled" type="checkbox"> <span>Research current web sources before compiling</span></label>
            <div class="form-actions"><button type="submit" ${workspace.loading ? "disabled" : ""}>Create environment</button><p class="creation-note">Requests are public to the selected name. The same name always shares one profile.</p></div>
          </form>
        </section>
      </section>
      <aside>
        <section class="achievement" aria-labelledby="achievement-heading"><h2 id="achievement-heading">Cross-environment explorer</h2><p>Make progress across your learning environments.</p><div class="meter" aria-label="${activeCount} of ${ENVIRONMENTS.length} environments started"><span style="width:${achievementPercent}%"></span></div><p>${activeCount} of ${ENVIRONMENTS.length} environments started</p></section>
        <section aria-labelledby="briefs-heading"><div class="section-heading"><h2 id="briefs-heading">Creation requests</h2><span>${currentBriefs.length}</span></div>${currentBriefs.length ? `<ul class="draft-list">${currentBriefs.map((brief) => `<li class="draft-row"><div><h3>${escapeHtml(brief.title)}</h3><p>${escapeHtml(brief.topic)} - ${escapeHtml(brief.status)}${brief.researchEnabled ? " - web research" : ""}</p></div><a class="button secondary" href="#/brief/${encodeURIComponent(brief.id)}">View</a></li>`).join("")}</ul>` : '<p class="empty">No creation requests yet.</p>'}</section>
      </aside>
    </div>
  </div>`;
  document.querySelector("[data-brief-form]").addEventListener("submit", createBrief);
}

async function createBrief(event) {
  event.preventDefault();
  const username = localProfile().username;
  if (!username) {
    setProfileMessage("Choose a public name before creating an environment.", "error");
    usernameInput.focus();
    return;
  }
  const form = new FormData(event.currentTarget);
  const submitButton = event.currentTarget.querySelector("button[type=submit]");
  submitButton.disabled = true;
  try {
    const result = await api("/api/briefs", {
      method: "POST",
      body: JSON.stringify({
        username,
        title: form.get("title"),
        topic: form.get("topic"),
        level: form.get("level"),
        visibility: form.get("visibility"),
        outcome: form.get("outcome"),
        sources: form.get("sources"),
        scope: form.get("scope"),
        researchEnabled: form.get("researchEnabled") === "on",
      }),
    });
    await refreshWorkspace();
    location.hash = `#/brief/${encodeURIComponent(result.brief.id)}`;
  } catch (error) {
    setProfileMessage(error instanceof Error ? error.message : "Could not create the environment.", "error");
    submitButton.disabled = false;
  }
}

function renderBrief(briefId) {
  const brief = workspace.briefs.find((item) => item.id === briefId);
  if (!brief) {
    app.innerHTML = `<div class="draft-view"><a class="button secondary" href="#/">Back to workspace</a><p class="empty">${workspace.loading ? "Loading creation request..." : "Creation request not found on this shared profile."}</p></div>`;
    return;
  }
  const generatedLink = brief.generatedUrl ? `<a class="button" href="${escapeHtml(brief.generatedUrl)}">Open learning environment</a>` : "";
  const retryControl = brief.status === "failed" && brief.resumeAvailable ? '<button type="button" data-retry-brief>Continue generation</button><p class="creation-note" data-retry-message aria-live="polite"></p>' : "";
  app.innerHTML = `<article class="draft-view"><a class="button secondary" href="#/">Back to workspace</a><header><p class="eyebrow">${escapeHtml(brief.visibility)} - ${escapeHtml(brief.status)}</p><h1>${escapeHtml(brief.title)}</h1><p class="lede">${escapeHtml(brief.topic)}</p></header><dl><dt>Created</dt><dd>${escapeHtml(formatDate(brief.createdAt))}</dd><dt>Starting level</dt><dd>${escapeHtml(brief.level)}</dd><dt>Outcome</dt><dd>${escapeHtml(brief.outcome)}</dd><dt>Sources</dt><dd>${escapeHtml(brief.sources)}</dd><dt>Scope</dt><dd>${escapeHtml(brief.scope)}</dd><dt>Web research</dt><dd>${brief.researchEnabled ? "Requested before compilation" : "Not requested"}</dd>${brief.failureMessage ? `<dt>Generation result</dt><dd>${escapeHtml(brief.failureMessage)}</dd>` : ""}</dl>${generatedLink}${retryControl}</article>`;
  document.querySelector("[data-retry-brief]")?.addEventListener("click", async (event) => {
    event.currentTarget.disabled = true;
    const message = document.querySelector("[data-retry-message]");
    try {
      const result = await api(`/api/briefs/${encodeURIComponent(brief.id)}/retry`, { method: "POST" });
      message.textContent = result.resumedFromCheckpoint ? "Continuation queued." : "Generation queued.";
      await refreshWorkspace();
      renderBrief(brief.id);
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : "Could not continue generation.";
      event.currentTarget.disabled = false;
    }
  });
}

function render() {
  const match = location.hash.match(/^#\/brief\/([^/]+)$/);
  if (match) renderBrief(decodeURIComponent(match[1])); else renderDashboard();
}

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = usernameInput.value.trim();
  if (!username) return;
  try {
    const result = await api(`/api/profiles/${encodeURIComponent(username)}`, { method: "PUT" });
    writeJson(PROFILE_KEY, { username });
    setProfileMessage(result.shared ? `${username} already exists. You are viewing its shared profile.` : `${username} is now a shared profile.`, result.shared ? "shared" : "");
    await refreshWorkspace();
  } catch (error) {
    setProfileMessage(error instanceof Error ? error.message : "Could not use that name.", "error");
  }
});
window.addEventListener("hashchange", render);
window.addEventListener("storage", (event) => {
  if (event.key === PROFILE_KEY || event.key?.startsWith("learning-hub:progress:")) refreshWorkspace();
});
refreshWorkspace();
render();
