/**
 * BF6 Leaderboard — Frontend logic
 */

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

  let currentData = null;
  let sortColumn = "rank";
  let sortDirection = "asc";

  // Category toggle buttons
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

  // Fetch leaderboard
  fetchBtn.addEventListener("click", fetchLeaderboard);

  async function fetchLeaderboard() {
    const gameMode = gameModeSelect.value;
    const platform = platformSelect.value;
    const amount = amountSelect.value;

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

    const params = new URLSearchParams({
      platform,
      game_mode: gameMode,
      amount,
      categories: selectedCategories.join(","),
    });

    try {
      const response = await fetch(`/api/leaderboard?${params}`);
      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}`);
      }

      const data = await response.json();
      currentData = data;

      if (!data.players || data.players.length === 0) {
        showError(
          "Aucun joueur trouvé. Essayez un autre mode de jeu ou plateforme.",
        );
        showLoading(false);
        return;
      }

      renderSummary(data);
      renderLeaderboard(data);
      showLoading(false);
    } catch (err) {
      showError(`Erreur lors du chargement: ${err.message}`);
      showLoading(false);
    }
  }

  function renderSummary(data) {
    document.getElementById("total-players").textContent =
      data.players.length;
    document.getElementById("total-categories").textContent =
      data.total_categories;
    document.getElementById("max-score").textContent =
      data.max_possible_score;
    summaryEl.classList.remove("hidden");
  }

  function renderLeaderboard(data) {
    leaderboardBody.innerHTML = "";

    const maxScore = data.max_possible_score || 1;

    data.players.forEach((player) => {
      // Main row
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="${getRankClass(player.rank)}">
          ${getRankDisplay(player.rank)}
        </td>
        <td><strong>${escapeHtml(player.name)}</strong></td>
        <td>
          <div class="score-bar">
            <span class="score-value">${player.total_score.toFixed(1)}</span>
            <div class="score-bar-bg">
              <div class="score-bar-fill"
                   style="width: ${(player.total_score / maxScore) * 100}%"></div>
            </div>
          </div>
        </td>
        <td>${player.avg_score.toFixed(1)}</td>
        <td>${player.categories_count} / ${data.total_categories}</td>
        <td>
          <button class="details-btn"
                  data-player="${escapeHtml(player.name)}">
            Détails ▾
          </button>
        </td>
      `;
      leaderboardBody.appendChild(tr);

      // Details row
      const detailsTr = document.createElement("tr");
      detailsTr.classList.add("details-row");
      detailsTr.id = `details-${sanitizeId(player.name)}`;

      const detailsTd = document.createElement("td");
      detailsTd.colSpan = 6;
      detailsTd.classList.add("details-content");

      let barsHtml = '<div class="category-bars">';
      data.categories.forEach((cat) => {
        const catScore = player.categories[cat];
        if (catScore !== undefined) {
          barsHtml += `
            <div class="category-bar-item">
              <span class="category-bar-name">${escapeHtml(cat)}</span>
              <div class="category-bar-visual">
                <div class="category-bar-visual-fill"
                     style="width: ${catScore}%"></div>
              </div>
              <span class="category-bar-value">${catScore.toFixed(1)}</span>
            </div>
          `;
        } else {
          barsHtml += `
            <div class="category-bar-item">
              <span class="category-bar-name">${escapeHtml(cat)}</span>
              <div class="category-bar-visual">
                <div class="category-bar-visual-fill" style="width: 0%"></div>
              </div>
              <span class="category-bar-value" style="color: var(--text-secondary)">—</span>
            </div>
          `;
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
          `details-${sanitizeId(playerName)}`,
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

  // Sorting
  document.querySelectorAll("th.sortable").forEach((th) => {
    th.addEventListener("click", () => {
      const column = th.getAttribute("data-sort");
      if (sortColumn === column) {
        sortDirection = sortDirection === "asc" ? "desc" : "asc";
      } else {
        sortColumn = column;
        sortDirection = column === "name" ? "asc" : "desc";
      }

      // Update sort indicators
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

    // Re-assign ranks after sort by score
    if (column === "total_score" || column === "avg_score") {
      players.forEach((p, i) => {
        p.rank = i + 1;
      });
    }
  }

  // Helper functions
  function getRankClass(rank) {
    if (rank <= 3) return `rank-${rank}`;
    return "";
  }

  function getRankDisplay(rank) {
    const medals = { 1: "🥇", 2: "🥈", 3: "🥉" };
    return medals[rank]
      ? `<span class="rank-medal">${medals[rank]}</span> ${rank}`
      : rank;
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

  function showError(message) {
    errorEl.textContent = message;
    errorEl.classList.remove("hidden");
  }

  function hideError() {
    errorEl.classList.add("hidden");
  }
});
