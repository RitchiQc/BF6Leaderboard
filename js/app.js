/**
 * BF6 Leaderboard — Standalone static web app
 *
 * Fetches leaderboard data from Tracker.gg for Battlefield 6,
 * normalizes scores to percentiles, and aggregates them into
 * a composite ranking. Runs directly in the browser.
 */

// ─── Configuration ──────────────────────────────────────────────
// GameTools API is still used for live player counts.
const API_BASE_URL = "https://api.gametools.network/bf6";

// Tracker.gg API for leaderboard data.
const TRACKER_API_URL = "https://api.tracker.gg/api/v2/bf6/standard";
const FETCH_TIMEOUT_MS = 15000;
const FETCH_TIMEOUT_SECONDS = FETCH_TIMEOUT_MS / 1000;

// CORS proxies used to reach Tracker.gg from the browser.
// Tracker.gg does not set Access-Control-Allow-Origin for third-party origins,
// so we route requests through a proxy.  Change the URLs if you self-host one.
// If the first proxy fails (403 / network error), the next one is tried automatically.
const CORS_PROXIES = [
  { prefix: "https://corsproxy.io/?url=", encode: true },
  { prefix: "https://api.allorigins.win/raw?url=", encode: true },
  { prefix: "https://api.codetabs.com/v1/proxy?quest=", encode: true },
];

// Available leaderboard boards (metrics) on Tracker.gg.
// Each board represents one stat that players can be ranked by.
const LEADERBOARD_BOARDS = [
  { value: "MatchesWon", label: "Parties gagnées" },
  { value: "MatchesPlayed", label: "Parties jouées" },
  { value: "Kills", label: "Victimes" },
  { value: "Deaths", label: "Morts" },
  { value: "Assists", label: "Assistances" },
  { value: "KDRatio", label: "Ratio K/D" },
  { value: "WLPercentage", label: "% Victoires" },
  { value: "Score", label: "Score" },
  { value: "TimePlayed", label: "Temps joué" },
  { value: "KillsPerMinute", label: "Victimes/min" },
  { value: "ScorePerMinute", label: "Score/min" },
];

// Available gamemodes on Tracker.gg.
const GAMEMODES = [
  { value: "gm_strike", label: "Strike" },
  { value: "gm_conquest", label: "Conquête" },
  { value: "gm_breakthrough", label: "Percée" },
  { value: "gm_rush", label: "Ruée" },
];

// Available platforms on Tracker.gg.
const PLATFORMS = [
  { value: "all", label: "Toutes" },
  { value: "origin", label: "PC (EA)" },
  { value: "psn", label: "PlayStation" },
  { value: "xbl", label: "Xbox" },
  { value: "steam", label: "Steam" },
];

// Boards where a lower value is better (player with least deaths is best).
const LOWER_IS_BETTER = ["Deaths"];

// ─── Initialization ─────────────────────────────────────────────
// Use readyState check so the app works even if DOMContentLoaded already fired
function initApp() {
  const fetchBtn = document.getElementById("fetch-btn");
  const gamemodeSelect = document.getElementById("gamemode");
  const platformSelect = document.getElementById("platform");
  const pagesSelect = document.getElementById("pages");
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

  // ─── CORS proxy helpers ─────────────────────────────────────
  // Wraps a URL through a specific CORS proxy entry.
  function proxiedUrl(url, proxy) {
    if (!proxy) return url;
    return proxy.prefix + (proxy.encode ? encodeURIComponent(url) : url);
  }

  // ─── Fetch with timeout helper ─────────────────────────────
  // Uses AbortSignal.timeout when available, with a fallback for
  // older browsers that only support AbortController.
  function fetchWithTimeout(url, timeoutMs, options) {
    var ms = timeoutMs || FETCH_TIMEOUT_MS;
    var baseOpts = options || {};
    if (typeof AbortSignal.timeout === "function") {
      return fetch(url, Object.assign({}, baseOpts, { signal: AbortSignal.timeout(ms) }));
    }
    var controller = new AbortController();
    setTimeout(function () { controller.abort(); }, ms);
    return fetch(url, Object.assign({}, baseOpts, { signal: controller.signal }));
  }

  // ─── Fetch through CORS proxy with fallback ────────────────
  // Tries each configured proxy in order. Returns the first successful
  // (non-403) response. Throws if all proxies fail.
  async function fetchViaProxy(targetUrl, timeoutMs, options) {
    var lastError = null;
    for (var i = 0; i < CORS_PROXIES.length; i++) {
      var proxy = CORS_PROXIES[i];
      var url = proxiedUrl(targetUrl, proxy);
      try {
        var response = await fetchWithTimeout(url, timeoutMs, options);
        if (response.status === 403) {
          lastError = new Error("Proxy " + proxy.prefix + " returned 403");
          continue; // try next proxy
        }
        return response;
      } catch (e) {
        lastError = e;
        // network / timeout error — try next proxy
      }
    }
    throw lastError || new Error("Tous les proxies CORS ont échoué");
  }

  // ─── Populate selectors from config ─────────────────────────
  // Populate gamemode dropdown
  if (gamemodeSelect && gamemodeSelect.options.length <= 1) {
    gamemodeSelect.innerHTML = "";
    GAMEMODES.forEach((gm) => {
      const opt = document.createElement("option");
      opt.value = gm.value;
      opt.textContent = gm.label;
      gamemodeSelect.appendChild(opt);
    });
  }

  // Populate platform dropdown
  if (platformSelect && platformSelect.options.length <= 1) {
    platformSelect.innerHTML = "";
    PLATFORMS.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.value;
      opt.textContent = p.label;
      platformSelect.appendChild(opt);
    });
  }

  // Populate board checkboxes
  const fallbackCheckboxes = categoriesGrid.querySelectorAll('input[type="checkbox"]');
  if (fallbackCheckboxes.length !== LEADERBOARD_BOARDS.length) {
    categoriesGrid.innerHTML = "";
    LEADERBOARD_BOARDS.forEach((board) => {
      const label = document.createElement("label");
      label.className = "checkbox-label";
      label.innerHTML =
        '<input type="checkbox" name="category" value="' +
        escapeHtml(board.value) +
        '" checked><span>' +
        escapeHtml(board.label) +
        "</span>";
      categoriesGrid.appendChild(label);
    });
  }

  // ─── API Status ─────────────────────────────────────────────
  const apiStatusToggle = document.getElementById("api-status-toggle");
  const apiStatusBody = document.getElementById("api-status-body");
  const apiRecheckBtn = document.getElementById("api-recheck-btn");

  if (apiStatusToggle && apiStatusBody) {
    apiStatusToggle.addEventListener("click", () => {
      const isHidden = apiStatusBody.classList.toggle("hidden");
      apiStatusToggle.textContent = isHidden ? "Afficher" : "Masquer";
    });
  }

  if (apiRecheckBtn) {
    apiRecheckBtn.addEventListener("click", () => {
      checkApiStatus();
    });
  }

  checkApiStatus();

  function setApiIndicator(id, status, detail) {
    const indicator = document.getElementById("api-indicator-" + id);
    const detailEl = document.getElementById("api-detail-" + id);
    if (!indicator || !detailEl) return;
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
    setApiIndicator("tracker", "checking", "Vérification...");
    setApiIndicator("players", "checking", "Vérification...");

    // Run all three checks in parallel so none stays at "Vérification..." while others complete
    await Promise.allSettled([
      checkMainApi(),
      checkTrackerApi(),
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

  async function checkTrackerApi() {
    const lbStart = performance.now();
    try {
      const targetUrl =
        TRACKER_API_URL + "/leaderboards?type=gamemodes&platform=all&board=Kills&gamemode=gm_strike&page=1";
      const response = await fetchViaProxy(targetUrl, FETCH_TIMEOUT_MS);
      const elapsed = Math.round(performance.now() - lbStart);
      if (response.ok) {
        setApiIndicator("tracker", "ok", "En ligne — " + elapsed + " ms");
      } else if (response.status === 403) {
        setApiIndicator(
          "tracker",
          "error",
          "Bloqué (403) — tous les proxies ont échoué — " + elapsed + " ms",
        );
      } else {
        setApiIndicator(
          "tracker",
          "error",
          "Erreur HTTP " + response.status + " — " + elapsed + " ms",
        );
      }
    } catch (e) {
      const elapsed = Math.round(performance.now() - lbStart);
      if (e.name === "TimeoutError" || e.name === "AbortError") {
        setApiIndicator("tracker", "error", "Timeout (" + FETCH_TIMEOUT_SECONDS + "s) — API injoignable");
      } else {
        setApiIndicator(
          "tracker",
          "error",
          "Erreur réseau / CORS — " + elapsed + " ms",
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
  if (selectAllBtn) {
    selectAllBtn.addEventListener("click", () => {
      document
        .querySelectorAll('#categories-grid input[type="checkbox"]')
        .forEach((cb) => {
          cb.checked = true;
        });
    });
  }

  if (deselectAllBtn) {
    deselectAllBtn.addEventListener("click", () => {
      document
        .querySelectorAll('#categories-grid input[type="checkbox"]')
        .forEach((cb) => {
          cb.checked = false;
        });
    });
  }

  // ─── Fetch leaderboard ──────────────────────────────────────
  if (fetchBtn) {
    fetchBtn.addEventListener("click", fetchLeaderboard);
  }

  async function fetchLeaderboard() {
    const gamemode = gamemodeSelect.value;
    const platform = platformSelect.value;
    const pages = parseInt(pagesSelect.value, 10);

    const selectedBoards = Array.from(
      document.querySelectorAll(
        '#categories-grid input[type="checkbox"]:checked',
      ),
    ).map((cb) => cb.value);

    if (selectedBoards.length === 0) {
      showError("Veuillez sélectionner au moins un critère (board).");
      return;
    }

    showLoading(true);
    hideError();
    summaryEl.classList.add("hidden");
    leaderboardSection.classList.add("hidden");
    showProgress(true);

    try {
      const data = await aggregateLeaderboard(
        selectedBoards,
        gamemode,
        platform,
        pages,
      );
      currentData = data;

      showProgress(false);

      if (!data.players || data.players.length === 0) {
        if (data.failed_categories === data.total_categories) {
          showError(
            "Tracker.gg est inaccessible. Le proxy CORS ou l'API Tracker.gg peut être temporairement hors service. Réessayez dans quelques instants.",
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

  // ─── API Fetching (Tracker.gg) ────────────────────────────────
  // Fetches a single page of leaderboard data from Tracker.gg.
  // Returns an array of { name, value, rank } objects.
  async function fetchTrackerPage(board, gamemode, platform, page) {
    const params = new URLSearchParams({
      type: "gamemodes",
      platform: platform,
      board: board,
      gamemode: gamemode,
      page: String(page),
    });

    const targetUrl = TRACKER_API_URL + "/leaderboards?" + params.toString();
    const response = await fetchViaProxy(targetUrl, FETCH_TIMEOUT_MS);

    if (!response.ok) {
      throw new Error(
        "Erreur Tracker.gg pour " + board + " (HTTP " + response.status + ")",
      );
    }

    const json = await response.json();
    const items = (json.data && json.data.items) || [];

    return items.map((item) => ({
      name: (item.owner && item.owner.displayName) || "Unknown",
      value: item.value != null ? item.value : 0,
      rank: item.rank || 0,
    }));
  }

  // Fetches all pages for a single board and merges them.
  async function fetchBoardLeaderboard(board, gamemode, platform, pages) {
    const allEntries = [];

    for (let page = 1; page <= pages; page++) {
      const entries = await fetchTrackerPage(board, gamemode, platform, page);
      allEntries.push.apply(allEntries, entries);
      if (entries.length === 0) break; // No more data
    }

    return allEntries;
  }

  // ─── Normalization ──────────────────────────────────────────
  // Takes an array of { name, value } entries for a single board
  // and converts each value to a 0–100 percentile.
  function normalizeEntries(entries, board) {
    if (!entries || entries.length === 0) {
      return {};
    }

    const sorted = entries
      .slice()
      .sort((a, b) => a.value - b.value);

    const total = sorted.length;
    if (total <= 1) {
      const result = {};
      result[sorted[0].name] = 100;
      return result;
    }

    const normalized = {};
    for (let rank = 0; rank < total; rank++) {
      let percentile = (rank / (total - 1)) * 100;
      if (LOWER_IS_BETTER.includes(board)) {
        percentile = 100 - percentile;
      }
      normalized[sorted[rank].name] = Math.round(percentile * 100) / 100;
    }

    return normalized;
  }

  // ─── Aggregation ────────────────────────────────────────────
  async function aggregateLeaderboard(
    boards,
    gamemode,
    platform,
    pages,
  ) {
    const totalBoards = boards.length;
    let completed = 0;

    updateProgress(0, totalBoards);

    // Fetch leaderboard entries for each selected board in parallel.
    const boardResults = await Promise.all(
      boards.map(async (board) => {
        try {
          const entries = await fetchBoardLeaderboard(
            board,
            gamemode,
            platform,
            pages,
          );
          completed++;
          updateProgress(completed, totalBoards);
          return { board: board, entries: entries, error: false };
        } catch (err) {
          completed++;
          updateProgress(completed, totalBoards);
          console.warn("Erreur pour le board " + board + ":", err);
          return { board: board, entries: [], error: true };
        }
      }),
    );

    const failedCount = boardResults.filter((r) => r.error).length;

    // Normalize each board independently
    const normalizedByBoard = {};
    for (const result of boardResults) {
      if (!result.error && result.entries.length > 0) {
        normalizedByBoard[result.board] = normalizeEntries(
          result.entries,
          result.board,
        );
      }
    }

    // Aggregate: sum normalized scores per player
    const playerScores = {};
    for (const board of boards) {
      const scores = normalizedByBoard[board] || {};
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
        playerScores[playerName].categories[board] = score;
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

    // Build display labels for boards (used in rendering)
    const boardLabels = {};
    for (const b of LEADERBOARD_BOARDS) {
      boardLabels[b.value] = b.label;
    }

    return {
      players: sortedPlayers,
      categories: boards,
      categoryLabels: boardLabels,
      max_possible_score: boards.length * 100,
      total_categories: boards.length,
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
    const labels = data.categoryLabels || {};

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
        const displayName = labels[cat] || cat;
        if (catScore !== undefined) {
          barsHtml +=
            '<div class="category-bar-item">' +
            '<span class="category-bar-name">' +
            escapeHtml(displayName) +
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
            escapeHtml(displayName) +
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
      "Chargement des critères: " + completed + " / " + total;
  }

  function showError(message) {
    errorEl.textContent = message;
    errorEl.classList.remove("hidden");
  }

  function hideError() {
    errorEl.classList.add("hidden");
  }
}

// ─── Bootstrap ──────────────────────────────────────────────────
// Run initApp as soon as the DOM is ready.  If DOMContentLoaded
// already fired (readyState is "interactive" or "complete"),
// run immediately; otherwise wait for the event.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
