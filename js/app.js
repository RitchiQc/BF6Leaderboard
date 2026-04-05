/**
 * BF6 Leaderboard — Standalone static web app
 *
 * All configuration, API fetching, normalization, and aggregation
 * logic runs directly in the browser. No backend required.
 */

// ─── Configuration ──────────────────────────────────────────────
const API_BASE_URL = "https://api.gametools.network/bf6";
const FETCH_TIMEOUT_MS = 10000;
const FETCH_TIMEOUT_SECONDS = FETCH_TIMEOUT_MS / 1000;

const LEADERBOARD_CATEGORIES = [
  "kills",
  "deaths",
  "wins",
  "losses",
  "assists",
  "revives",
  "headshots",
  "killsPerMinute",
  "damagePerMinute",
  "scorePerMinute",
  "winPercent",
  "killDeath",
  "infantryKillDeath",
  "bestSquad",
  "vehiclesDestroyed",
  "saviorKills",
  "avengerKills",
  "spotEnemies",
  "objectiveTime",
  "timePlayed",
];

const LOWER_IS_BETTER = ["deaths", "losses"];

// ─── DOM References ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const fetchBtn = document.getElementById("fetch-btn");
  const gameModeSelect = document.getElementById("game-mode");
  const platformSelect = document.getElementById("platform");
  const amountSelect = document.getElementById("amount");
  const loadingEl = document.getElementById("loading");
  const errorEl = document.getElementById("error");
  const summaryEl = document.getElementById("summary");
  const leaderboardSection = document.getElementById("leaderboard-section");
  const leaderboardBody = document.getElementById("leaderboard-body");
  const selectAllBtn = document.getElementById("select-all-cats");
  const deselectAllBtn = document.getElementById("deselect-all-cats");
  const categoriesGrid = document.getElementById("categories-grid");
  const progressContainer = document.getElementById("progress");
  const progressBar = document.getElementById("progress-bar");
  const progressText = document.getElementById("progress-text");

  let currentData = null;
  let sortColumn = "rank";
  let sortDirection = "asc";

  // ─── Fetch with timeout helper ─────────────────────────────
  // AbortSignal.timeout keeps the abort signal active for the entire
  // duration (including body reading via response.json()), so a slow
  // body transfer will still be terminated after the timeout fires.
  function fetchWithTimeout(url, timeoutMs) {
    return fetch(url, {
      signal: AbortSignal.timeout(timeoutMs || FETCH_TIMEOUT_MS),
    });
  }

  // ─── Populate categories from config ────────────────────────
  // If HTML already contains fallback checkboxes, verify they match config.
  // Otherwise (or if empty), rebuild them from the JS config.
  const fallbackCheckboxes = categoriesGrid.querySelectorAll('input[type="checkbox"]');
  if (fallbackCheckboxes.length !== LEADERBOARD_CATEGORIES.length) {
    categoriesGrid.innerHTML = "";
    LEADERBOARD_CATEGORIES.forEach((cat) => {
      const label = document.createElement("label");
      label.className = "checkbox-label";
      label.innerHTML =
        '<input type="checkbox" name="category" value="' +
        escapeHtml(cat) +
        '" checked><span>' +
        escapeHtml(cat) +
        "</span>";
      categoriesGrid.appendChild(label);
    });
  }

  // ─── API Status ─────────────────────────────────────────────
  const apiStatusToggle = document.getElementById("api-status-toggle");
  const apiStatusBody = document.getElementById("api-status-body");
  const apiRecheckBtn = document.getElementById("api-recheck-btn");

  apiStatusToggle.addEventListener("click", () => {
    const isHidden = apiStatusBody.classList.toggle("hidden");
    apiStatusToggle.textContent = isHidden ? "Afficher" : "Masquer";
  });

  apiRecheckBtn.addEventListener("click", () => {
    checkApiStatus();
  });

  checkApiStatus();

  function setApiIndicator(id, status, detail) {
    const indicator = document.getElementById("api-indicator-" + id);
    const detailEl = document.getElementById("api-detail-" + id);
    indicator.className = "api-status-indicator " + status;
    if (status === "ok") {
      indicator.textContent = "✅";
    } else if (status === "error") {
      indicator.textContent = "❌";
    } else {
      indicator.textContent = "⏳";
    }
    detailEl.textContent = detail;
  }

  async function checkApiStatus() {
    const timeEl = document.getElementById("api-status-time");

    setApiIndicator("main", "checking", "Vérification...");
    setApiIndicator("leaderboard", "checking", "Vérification...");
    setApiIndicator("players", "checking", "Vérification...");

    // Run all three checks in parallel so none stays at "Vérification..." while others complete
    await Promise.allSettled([
      checkMainApi(),
      checkLeaderboardApi(),
      checkPlayersApi(),
    ]);

    timeEl.textContent =
      "Dernière vérification : " +
      new Date().toLocaleTimeString("fr-FR");
  }

  async function checkMainApi() {
    const mainStart = performance.now();
    try {
      const response = await fetchWithTimeout(
        API_BASE_URL + "/statusarray/?days=1&region=all&platform=pc",
        FETCH_TIMEOUT_MS,
      );
      const elapsed = Math.round(performance.now() - mainStart);
      if (response.ok) {
        const data = await response.json();
        const amounts = data.soldierAmount || [];
        if (amounts.length > 0) {
          setApiIndicator("main", "ok", "En ligne — " + elapsed + " ms");
        } else {
          setApiIndicator(
            "main",
            "ok",
            "Accessible mais données vides — " + elapsed + " ms",
          );
        }
      } else {
        setApiIndicator(
          "main",
          "error",
          "Erreur HTTP " + response.status + " — " + elapsed + " ms",
        );
      }
    } catch (e) {
      const elapsed = Math.round(performance.now() - mainStart);
      if (e.name === "TimeoutError" || e.name === "AbortError") {
        setApiIndicator("main", "error", "Timeout (" + FETCH_TIMEOUT_SECONDS + "s) — API injoignable");
      } else {
        setApiIndicator("main", "error", "Erreur réseau — " + elapsed + " ms");
      }
    }
  }

  async function checkLeaderboardApi() {
    const lbStart = performance.now();
    try {
      const response = await fetchWithTimeout(
        API_BASE_URL + "/leaderboard/?name=kills&platform=pc&skip=0&amount=1",
        FETCH_TIMEOUT_MS,
      );
      const elapsed = Math.round(performance.now() - lbStart);
      if (response.ok) {
        setApiIndicator("leaderboard", "ok", "En ligne — " + elapsed + " ms");
      } else {
        setApiIndicator(
          "leaderboard",
          "error",
          "Erreur HTTP " + response.status + " — " + elapsed + " ms",
        );
      }
    } catch (e) {
      const elapsed = Math.round(performance.now() - lbStart);
      if (e.name === "TimeoutError" || e.name === "AbortError") {
        setApiIndicator("leaderboard", "error", "Timeout (" + FETCH_TIMEOUT_SECONDS + "s) — API injoignable");
      } else {
        setApiIndicator(
          "leaderboard",
          "error",
          "Erreur réseau — " + elapsed + " ms",
        );
      }
    }
  }

  async function checkPlayersApi() {
    const pcStart = performance.now();
    try {
      const platforms = ["pc", "xboxseries", "ps5"];
      const results = await Promise.all(
        platforms.map(async (platform) => {
          try {
            const response = await fetchWithTimeout(
              API_BASE_URL +
                "/statusarray/?days=1&region=all&platform=" +
                platform,
              FETCH_TIMEOUT_MS,
            );
            if (!response.ok) return { platform: platform, ok: false };
            return { platform: platform, ok: true };
          } catch (e) {
            return { platform: platform, ok: false };
          }
        }),
      );
      const elapsed = Math.round(performance.now() - pcStart);
      const okCount = results.filter((r) => r.ok).length;
      if (okCount > 0) {
        setApiIndicator(
          "players",
          "ok",
          okCount + "/" + platforms.length + " plateformes OK — " + elapsed + " ms",
        );
      } else {
        setApiIndicator(
          "players",
          "error",
          "Aucune plateforme accessible — " + elapsed + " ms",
        );
      }
    } catch (e) {
      setApiIndicator("players", "error", "Erreur réseau");
    }
  }

  // ─── Fetch and display online player count ─────────────────
  fetchPlayerCount();

  async function fetchPlayerCount() {
    const playerCountText = document.getElementById("player-count-text");
    try {
      const platforms = ["pc", "xboxseries", "ps5"];
      const results = await Promise.all(
        platforms.map(async (platform) => {
          try {
            const url =
              API_BASE_URL +
              "/statusarray/?days=1&region=all&platform=" +
              platform;
            const response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
            if (!response.ok) return 0;
            const data = await response.json();
            const amounts = data.soldierAmount || [];
            return amounts.length > 0 ? amounts[amounts.length - 1] : 0;
          } catch (e) {
            return 0;
          }
        }),
      );
      const total = results.reduce((sum, count) => sum + count, 0);
      if (total > 0) {
        playerCountText.textContent =
          total.toLocaleString("fr-FR") + " joueurs en ligne";
      } else {
        playerCountText.textContent = "Joueurs en ligne : indisponible";
      }
    } catch (e) {
      playerCountText.textContent = "Joueurs en ligne : indisponible";
    }
  }

  // ─── Category toggle buttons ────────────────────────────────
  selectAllBtn.addEventListener("click", () => {
    document
      .querySelectorAll('#categories-grid input[type="checkbox"]')
      .forEach((cb) => {
        cb.checked = true;
      });
  });

  deselectAllBtn.addEventListener("click", () => {
    document
      .querySelectorAll('#categories-grid input[type="checkbox"]')
      .forEach((cb) => {
        cb.checked = false;
      });
  });

  // ─── Fetch leaderboard ──────────────────────────────────────
  fetchBtn.addEventListener("click", fetchLeaderboard);

  async function fetchLeaderboard() {
    const gameMode = gameModeSelect.value;
    const platform = platformSelect.value;
    const amount = parseInt(amountSelect.value, 10);

    const selectedCategories = Array.from(
      document.querySelectorAll(
        '#categories-grid input[type="checkbox"]:checked',
      ),
    ).map((cb) => cb.value);

    if (selectedCategories.length === 0) {
      showError("Veuillez sélectionner au moins une catégorie.");
      return;
    }

    showLoading(true);
    hideError();
    summaryEl.classList.add("hidden");
    leaderboardSection.classList.add("hidden");
    showProgress(true);

    try {
      const data = await aggregateLeaderboard(
        selectedCategories,
        platform,
        gameMode,
        amount,
      );
      currentData = data;

      showProgress(false);

      if (!data.players || data.players.length === 0) {
        if (data.failed_categories === data.total_categories) {
          showError(
            "L'API GameTools est inaccessible. Toutes les catégories ont échoué. Vérifiez le statut de l'API ci-dessus et réessayez plus tard.",
          );
        } else {
          showError(
            "Aucun joueur trouvé. Essayez un autre mode de jeu ou plateforme.",
          );
        }
        showLoading(false);
        return;
      }

      renderSummary(data);
      renderLeaderboard(data);
      showLoading(false);
    } catch (err) {
      showProgress(false);
      showError("Erreur lors du chargement: " + err.message);
      showLoading(false);
    }
  }

  // ─── API Fetching ───────────────────────────────────────────
  async function fetchCategoryLeaderboard(
    category,
    platform,
    gameMode,
    amount,
  ) {
    const params = new URLSearchParams({
      name: category,
      platform: platform,
      skip: "0",
      amount: String(amount),
    });

    if (gameMode && gameMode !== "all") {
      params.set("gamemode", gameMode);
    }

    const url = API_BASE_URL + "/leaderboard/?" + params.toString();
    const response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);

    if (!response.ok) {
      throw new Error(
        "Erreur API pour " + category + " (HTTP " + response.status + ")",
      );
    }

    const data = await response.json();
    return data.data || [];
  }

  // ─── Normalization ──────────────────────────────────────────
  function normalizeScores(players, category) {
    if (!players || players.length === 0) {
      return {};
    }

    const values = players
      .map((p) => ({
        name: p.name || "Unknown",
        value: p.value || 0,
      }))
      .sort((a, b) => a.value - b.value);

    const total = values.length;
    if (total <= 1) {
      const result = {};
      result[values[0].name] = 100;
      return result;
    }

    const normalized = {};
    for (let rank = 0; rank < total; rank++) {
      let percentile = (rank / (total - 1)) * 100;
      if (LOWER_IS_BETTER.includes(category)) {
        percentile = 100 - percentile;
      }
      normalized[values[rank].name] = Math.round(percentile * 100) / 100;
    }

    return normalized;
  }

  // ─── Aggregation ────────────────────────────────────────────
  async function aggregateLeaderboard(
    categories,
    platform,
    gameMode,
    amount,
  ) {
    const totalCats = categories.length;
    let completed = 0;

    updateProgress(0, totalCats);

    // Fetch all categories concurrently with progress tracking
    const categoryResults = await Promise.all(
      categories.map(async (cat) => {
        try {
          const players = await fetchCategoryLeaderboard(
            cat,
            platform,
            gameMode,
            amount,
          );
          completed++;
          updateProgress(completed, totalCats);
          return { category: cat, players: players, error: false };
        } catch (err) {
          completed++;
          updateProgress(completed, totalCats);
          console.warn("Erreur pour la catégorie " + cat + ":", err);
          return { category: cat, players: [], error: true };
        }
      }),
    );

    const failedCount = categoryResults.filter((r) => r.error).length;

    // Normalize each category
    const normalizedByCategory = {};
    for (const result of categoryResults) {
      normalizedByCategory[result.category] = normalizeScores(
        result.players,
        result.category,
      );
    }

    // Aggregate: sum normalized scores per player
    const playerScores = {};
    for (const cat of categories) {
      const scores = normalizedByCategory[cat] || {};
      for (const [playerName, score] of Object.entries(scores)) {
        if (!playerScores[playerName]) {
          playerScores[playerName] = {
            name: playerName,
            total_score: 0,
            categories: {},
            categories_count: 0,
          };
        }
        playerScores[playerName].total_score += score;
        playerScores[playerName].categories[cat] = score;
        playerScores[playerName].categories_count += 1;
      }
    }

    // Sort by total score descending
    const sortedPlayers = Object.values(playerScores).sort(
      (a, b) => b.total_score - a.total_score,
    );

    // Add rank and avg
    for (let i = 0; i < sortedPlayers.length; i++) {
      const player = sortedPlayers[i];
      player.rank = i + 1;
      player.total_score = Math.round(player.total_score * 100) / 100;
      player.avg_score =
        player.categories_count > 0
          ? Math.round((player.total_score / player.categories_count) * 100) /
            100
          : 0;
    }

    return {
      players: sortedPlayers,
      categories: categories,
      max_possible_score: categories.length * 100,
      total_categories: categories.length,
      failed_categories: failedCount,
    };
  }

  // ─── Rendering ──────────────────────────────────────────────
  function renderSummary(data) {
    document.getElementById("total-players").textContent = data.players.length;
    document.getElementById("total-categories").textContent =
      data.total_categories;
    document.getElementById("max-score").textContent = data.max_possible_score;
    summaryEl.classList.remove("hidden");
  }

  function renderLeaderboard(data) {
    leaderboardBody.innerHTML = "";

    const maxScore = data.max_possible_score || 1;

    data.players.forEach((player) => {
      // Main row
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td class="' +
        getRankClass(player.rank) +
        '">' +
        getRankDisplay(player.rank) +
        "</td>" +
        "<td><strong>" +
        escapeHtml(player.name) +
        "</strong></td>" +
        "<td>" +
        '<div class="score-bar">' +
        '<span class="score-value">' +
        player.total_score.toFixed(1) +
        "</span>" +
        '<div class="score-bar-bg">' +
        '<div class="score-bar-fill" style="width: ' +
        (player.total_score / maxScore) * 100 +
        '%"></div>' +
        "</div>" +
        "</div>" +
        "</td>" +
        "<td>" +
        player.avg_score.toFixed(1) +
        "</td>" +
        "<td>" +
        player.categories_count +
        " / " +
        data.total_categories +
        "</td>" +
        "<td>" +
        '<button class="details-btn" data-player="' +
        escapeHtml(player.name) +
        '">' +
        "Détails ▾" +
        "</button>" +
        "</td>";
      leaderboardBody.appendChild(tr);

      // Details row
      const detailsTr = document.createElement("tr");
      detailsTr.classList.add("details-row");
      detailsTr.id = "details-" + sanitizeId(player.name);

      const detailsTd = document.createElement("td");
      detailsTd.colSpan = 6;
      detailsTd.classList.add("details-content");

      let barsHtml = '<div class="category-bars">';
      data.categories.forEach((cat) => {
        const catScore = player.categories[cat];
        if (catScore !== undefined) {
          barsHtml +=
            '<div class="category-bar-item">' +
            '<span class="category-bar-name">' +
            escapeHtml(cat) +
            "</span>" +
            '<div class="category-bar-visual">' +
            '<div class="category-bar-visual-fill" style="width: ' +
            catScore +
            '%"></div>' +
            "</div>" +
            '<span class="category-bar-value">' +
            catScore.toFixed(1) +
            "</span>" +
            "</div>";
        } else {
          barsHtml +=
            '<div class="category-bar-item">' +
            '<span class="category-bar-name">' +
            escapeHtml(cat) +
            "</span>" +
            '<div class="category-bar-visual">' +
            '<div class="category-bar-visual-fill" style="width: 0%"></div>' +
            "</div>" +
            '<span class="category-bar-value" style="color: var(--text-secondary)">—</span>' +
            "</div>";
        }
      });
      barsHtml += "</div>";

      detailsTd.innerHTML = barsHtml;
      detailsTr.appendChild(detailsTd);
      leaderboardBody.appendChild(detailsTr);
    });

    // Toggle details on click
    leaderboardBody.querySelectorAll(".details-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const playerName = btn.getAttribute("data-player");
        const detailsRow = document.getElementById(
          "details-" + sanitizeId(playerName),
        );
        if (detailsRow) {
          detailsRow.classList.toggle("open");
          btn.textContent = detailsRow.classList.contains("open")
            ? "Détails ▴"
            : "Détails ▾";
        }
      });
    });

    leaderboardSection.classList.remove("hidden");
  }

  // ─── Sorting ────────────────────────────────────────────────
  document.querySelectorAll("th.sortable").forEach((th) => {
    th.addEventListener("click", () => {
      const column = th.getAttribute("data-sort");
      if (sortColumn === column) {
        sortDirection = sortDirection === "asc" ? "desc" : "asc";
      } else {
        sortColumn = column;
        sortDirection = column === "name" ? "asc" : "desc";
      }

      document.querySelectorAll("th.sortable").forEach((h) => {
        h.classList.remove("sort-asc", "sort-desc");
      });
      th.classList.add(sortDirection === "asc" ? "sort-asc" : "sort-desc");

      if (currentData) {
        sortData(currentData.players, column, sortDirection);
        renderLeaderboard(currentData);
      }
    });
  });

  function sortData(players, column, direction) {
    players.sort((a, b) => {
      let valA = a[column];
      let valB = b[column];

      if (typeof valA === "string") {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return direction === "asc" ? -1 : 1;
      if (valA > valB) return direction === "asc" ? 1 : -1;
      return 0;
    });

    if (column === "total_score" || column === "avg_score") {
      players.forEach((p, i) => {
        p.rank = i + 1;
      });
    }
  }

  // ─── Helper functions ───────────────────────────────────────
  function getRankClass(rank) {
    if (rank <= 3) return "rank-" + rank;
    return "";
  }

  function getRankDisplay(rank) {
    const medals = { 1: "🥇", 2: "🥈", 3: "🥉" };
    if (medals[rank]) {
      return '<span class="rank-medal">' + medals[rank] + "</span> " + rank;
    }
    return String(rank);
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function sanitizeId(name) {
    return name.replace(/[^a-zA-Z0-9]/g, "_");
  }

  function showLoading(show) {
    loadingEl.classList.toggle("hidden", !show);
    fetchBtn.disabled = show;
  }

  function showProgress(show) {
    progressContainer.classList.toggle("hidden", !show);
  }

  function updateProgress(completed, total) {
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    progressBar.style.width = pct + "%";
    progressText.textContent =
      "Chargement des catégories: " + completed + " / " + total;
  }

  function showError(message) {
    errorEl.textContent = message;
    errorEl.classList.remove("hidden");
  }

  function hideError() {
    errorEl.classList.add("hidden");
  }
});
