const revealItems = document.querySelectorAll(".reveal");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if ("IntersectionObserver" in window && !reduceMotion) {
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

const yearEl = document.querySelector("#year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* Projects — pulled from the GitHub API, newest/best first. */
const GITHUB_USER = "noxilith";
const MAX_REPOS = 4;
const REPO_CACHE_KEY = "noxilith:repos:v2";
const REPO_CACHE_TTL = 15 * 60 * 1000;

const CONTRIBUTIONS_API = `https://github-contributions-api.jogruber.de/v4/${GITHUB_USER}?y=last`;
const CONTRIBUTIONS_CACHE_KEY = "noxilith:contributions:v1";
const CONTRIBUTIONS_CACHE_TTL = 6 * 60 * 60 * 1000;
const HEATMAP_MONTHS = 6;

const repoGrid = document.querySelector(".project-grid");
const workCount = document.querySelector(".work .eyebrow span:last-child");
const placeholderTemplate = repoGrid?.querySelector(".project-placeholder");

const starsValue = document.getElementById("stat-stars");
const contributionsValue = document.getElementById("stat-contributions");
const heatmap = document.getElementById("heatmap");
const heatmapLegend = document.querySelector(".heatmap-legend");
const heatmapBlock = document.querySelector(".stat-heatmap");

function formatCount(value) {
  return value.toLocaleString("en-US");
}

function setStars(total) {
  if (starsValue && Number.isFinite(total)) starsValue.textContent = formatCount(total);
}

function recentDays(days, months) {
  if (!days.length) return days;

  const cutoff = new Date(days[days.length - 1].date);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);

  let start = days.findIndex((day) => new Date(day.date) >= cutoff);
  if (start < 0) return days;

  // Step back to the previous Sunday so the columns line up as whole weeks.
  while (start > 0 && new Date(days[start].date).getUTCDay() !== 0) start -= 1;
  return days.slice(start);
}

function renderContributions(data) {
  if (!data) return;

  const total = data.total?.lastYear;
  if (contributionsValue && Number.isFinite(total)) contributionsValue.textContent = formatCount(total);

  const days = recentDays(data.contributions || [], HEATMAP_MONTHS);
  if (!heatmap || !days.length) return;

  heatmap.replaceChildren(...days.map((day) => {
    const cell = document.createElement("span");
    cell.className = `lvl-${Math.min(4, Math.max(0, day.level || 0))}`;
    cell.title = `${day.count} contribution${day.count === 1 ? "" : "s"} on ${day.date}`;
    return cell;
  }));

  if (heatmapBlock) heatmapBlock.hidden = false;
  heatmap.hidden = false;
  if (heatmapLegend) heatmapLegend.hidden = false;
}

async function loadContributions() {
  if (!heatmap) return;

  try {
    const cached = JSON.parse(localStorage.getItem(CONTRIBUTIONS_CACHE_KEY) || "null");
    if (cached && Date.now() - cached.storedAt < CONTRIBUTIONS_CACHE_TTL && cached.data?.contributions?.length) {
      renderContributions(cached.data);
      return;
    }
  } catch {
    /* storage unavailable — fall through to the network */
  }

  try {
    const response = await fetch(CONTRIBUTIONS_API, { headers: { Accept: "application/json" } });
    if (!response.ok) return;

    const data = await response.json();
    renderContributions(data);

    try {
      localStorage.setItem(CONTRIBUTIONS_CACHE_KEY, JSON.stringify({ storedAt: Date.now(), data }));
    } catch {
      /* ignore quota/privacy errors */
    }
  } catch {
    /* offline or blocked — the stats stay as dashes */
  }
}

function repoInitials(name) {
  const clean = name.replace(/[^a-z0-9]/gi, "");
  return (clean.slice(0, 2) || "GH").toUpperCase();
}

function buildRepoCard(repo, index, visual) {
  const card = document.createElement("article");
  card.className = "project-card reveal is-visible";

  if (!visual) {
    visual = document.createElement("div");
    visual.className = "project-visual auto-visual" + (index % 2 ? " tone-b" : "");

    const ring = document.createElement("div");
    ring.className = "auto-ring";
    const mark = document.createElement("span");
    mark.textContent = repoInitials(repo.name);
    ring.append(mark);

    const visualLabel = document.createElement("span");
    visualLabel.className = "visual-index";
    visualLabel.textContent = `${String(index + 1).padStart(2, "0")} / ${(repo.language || "REPOSITORY").toUpperCase()}`;

    visual.append(ring, visualLabel);
  }

  const info = document.createElement("div");
  info.className = "project-info";

  const text = document.createElement("div");
  const type = document.createElement("div");
  type.className = "project-type";
  type.append(repo.language ? repo.language.toUpperCase() : "REPOSITORY");

  if (repo.stargazers_count) {
    const star = document.createElement("span");
    star.className = "star";
    star.textContent = "★";
    const count = document.createElement("span");
    count.className = "star-count";
    count.textContent = repo.stargazers_count.toLocaleString("en-US");
    type.append(" · ", star, count);
  }

  const title = document.createElement("h3");
  title.textContent = repo.name;

  const description = document.createElement("p");
  description.textContent = repo.description || "No description yet. Still in progress.";

  text.append(type, title, description);

  const link = document.createElement("a");
  link.className = "round-link";
  link.href = repo.html_url;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.setAttribute("aria-label", `View ${repo.name} on GitHub`);
  link.innerHTML = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M17 7l-10 10"/><path d="M8 7l9 0l0 9"/></svg>';

  info.append(text, link);
  card.append(visual, info);
  return card;
}

function buildPlaceholderCard(index) {
  const card = placeholderTemplate.cloneNode(true);
  card.classList.add("is-visible");
  const label = card.querySelector(".visual-index");
  if (label) label.textContent = `${String(index + 1).padStart(2, "0")} / IN PROGRESS`;
  return card;
}

function renderRepos(repos) {
  if (!repoGrid || !repos.length) return;

  const staticCards = [...repoGrid.children].filter((card) => !card.classList.contains("project-placeholder"));
  const byName = new Map(staticCards.map((card) => [(card.querySelector("h3")?.textContent || "").toLowerCase(), card]));

  const cards = repos.slice(0, MAX_REPOS).map((repo, index) => {
    const handmade = byName.get(repo.name.toLowerCase());
    const visual = handmade?.querySelector(".project-visual")?.cloneNode(true) || null;

    // A hand-made visual carries its own caption, so renumber it to the slot it lands in.
    const caption = visual?.querySelector(".visual-index");
    if (caption) {
      const descriptor = caption.textContent.split("/").slice(1).join("/").trim() || "PROJECT";
      caption.textContent = `${String(index + 1).padStart(2, "0")} / ${descriptor}`;
    }

    return buildRepoCard(repo, index, visual);
  });

  // Empty slots stay visible as "coming soon" cards, so the grid is always full.
  const placeholders = [];
  for (let index = cards.length; index < MAX_REPOS; index += 1) {
    if (placeholderTemplate) placeholders.push(buildPlaceholderCard(index));
  }

  repoGrid.replaceChildren(...cards, ...placeholders);
  const total = cards.length + placeholders.length;
  if (workCount) workCount.textContent = `01 / ${String(total).padStart(2, "0")}`;
}

function pickTopRepos(repos) {
  return repos
    .filter((repo) => !repo.fork && !repo.archived)
    .filter((repo) => repo.name.toLowerCase() !== `${GITHUB_USER}.github.io`)
    .sort((a, b) => b.stargazers_count - a.stargazers_count || new Date(b.pushed_at) - new Date(a.pushed_at))
    .slice(0, MAX_REPOS);
}

async function loadRepos() {
  if (!repoGrid) return;

  try {
    const cached = JSON.parse(localStorage.getItem(REPO_CACHE_KEY) || "null");
    if (cached && Date.now() - cached.storedAt < REPO_CACHE_TTL && cached.repos?.length) {
      renderRepos(cached.repos);
      setStars(cached.stars);
      return;
    }
  } catch {
    /* storage unavailable — fall through to the network */
  }

  try {
    const response = await fetch(
      `https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=updated`,
      { headers: { Accept: "application/vnd.github+json" } }
    );
    if (!response.ok) return;

    const all = await response.json();
    const stars = all.filter((repo) => !repo.fork).reduce((sum, repo) => sum + (repo.stargazers_count || 0), 0);
    setStars(stars);

    const repos = pickTopRepos(all);
    if (!repos.length) return;

    try {
      localStorage.setItem(REPO_CACHE_KEY, JSON.stringify({ storedAt: Date.now(), repos, stars }));
    } catch {
      /* ignore quota/privacy errors */
    }

    renderRepos(repos);
  } catch {
    /* offline or blocked — the hand-written EloraNotes card stays as a fallback */
  }
}

loadRepos();
loadContributions();
