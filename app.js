const DATA_FILE = "team_generator_daten.json";

function rankFromElo(elo) {
  if (elo < 1050) return "Leon";
  if (elo < 1150) return "Iron";
  if (elo < 1200) return "Bronze";
  if (elo < 1250) return "Silver";
  if (elo < 1300) return "Gold";
  if (elo < 1350) return "Platin";
  if (elo < 1400) return "Emerald";
  if (elo < 1450) return "Diamond";
  if (elo < 1500) return "Master";
  if (elo < 1550) return "Grandmaster";
  return "Challenger";
}

function winrate(wins, losses) {
  const games = wins + losses;
  if (games === 0) return "0.0";
  return ((wins / games) * 100).toFixed(1);
}

function averageElo(names, players) {
  if (!names || names.length === 0) return 0;
  const sum = names.reduce((acc, name) => acc + (players[name]?.elo ?? 1200), 0);
  return Math.round(sum / names.length);
}

function medal(place) {
  if (place === 1) return "🥇";
  if (place === 2) return "🥈";
  if (place === 3) return "🥉";
  return place;
}

async function loadDashboard() {
  try {
    const response = await fetch(`${DATA_FILE}?v=${Date.now()}`);
    const data = await response.json();

    const playersObj = data.spieler || {};
    const matches = data.historie || [];
    const players = Object.entries(playersObj).map(([name, d]) => ({
      name,
      wins: d.wins ?? 0,
      losses: d.losses ?? 0,
      elo: d.elo ?? 1200
    }));

    players.sort((a, b) => {
      if (b.elo !== a.elo) return b.elo - a.elo;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.losses - b.losses;
    });

    renderOverview(players, matches);
    renderRanking(players);
    renderMatches(matches, playersObj);
    renderStats(players);
  } catch (error) {
    document.querySelector(".content").innerHTML = `
      <div class="card">
        <h2 style="color:#E11D48">Fehler beim Laden</h2>
        <p>Die Datei <strong>team_generator_daten.json</strong> konnte nicht geladen werden.</p>
      </div>
    `;
  }
}

function renderOverview(players, matches) {
  const totalPlayers = players.length;
  const topElo = players.length ? Math.max(...players.map(p => p.elo)) : 0;
  const avgElo = players.length
    ? Math.round(players.reduce((sum, p) => sum + p.elo, 0) / players.length)
    : 0;

  document.getElementById("totalPlayers").textContent = totalPlayers;
  document.getElementById("totalMatches").textContent = matches.length;
  document.getElementById("topElo").textContent = topElo;
  document.getElementById("avgElo").textContent = avgElo;
}

function renderRanking(players) {
  const list = document.getElementById("rankingList");
  list.innerHTML = "";

  if (players.length === 0) {
    list.innerHTML = `<div class="empty">Noch keine Spieler vorhanden.</div>`;
    return;
  }

  players.forEach((p, index) => {
    const rank = rankFromElo(p.elo);
    const row = document.createElement("div");
    row.className = "rank-row";
    row.innerHTML = `
      <div class="place">${medal(index + 1)}</div>
      <div class="rank-icon-wrap">
    <img class="rank-icon"
         src="/rank_icons/${rank}.png"
         alt="${rank}"
         onerror="this.style.display='none'; this.parentElement.innerHTML='${rank[0]}';">
      </div>
      <div>
        <div class="player-name">${escapeHtml(p.name)}</div>
        <div class="player-sub">${rank} | WR: ${winrate(p.wins, p.losses)}% | Games: ${p.wins + p.losses}</div>
      </div>
      <div class="elo">${p.elo} Elo</div>
      <div class="wl">${p.wins} - ${p.losses}</div>
    `;
    list.appendChild(row);
  });
}

function renderMatches(matches, players) {
  const list = document.getElementById("matchList");
  list.innerHTML = "";

  if (matches.length === 0) {
    list.innerHTML = `<div class="empty">Noch keine Matches gespeichert.</div>`;
    return;
  }

  matches.forEach(match => {
    const t1 = match.team1 || [];
    const t2 = match.team2 || [];
    const winnerText = match.gewinner === "Team 1" ? "🏆 Team 1 gewinnt" : "🏆 Team 2 gewinnt";

    const card = document.createElement("div");
    card.className = "match";
    card.innerHTML = `
      <div class="match-top">
        <div class="winner">${winnerText}</div>
        <div class="date">${escapeHtml(match.datum || "")}</div>
      </div>
      <div class="teams">
  <div class="team ${match.gewinner === "Team 1" ? "winner-team" : "loser-team"}">
    <div class="team-title">Team 1 · Ø ${averageElo(t1, players)} Elo</div>
    <div class="players">${t1.map(escapeHtml).join("<br>") || "Keine Spieler"}</div>
  </div>
  <div class="team ${match.gewinner === "Team 2" ? "winner-team" : "loser-team"}">
    <div class="team-title">Team 2 · Ø ${averageElo(t2, players)} Elo</div>
    <div class="players">${t2.map(escapeHtml).join("<br>") || "Keine Spieler"}</div>
  </div>
</div>
    `;
    list.appendChild(card);
  });
}

function renderStats(players) {
  const list = document.getElementById("statsList");

  if (players.length === 0) {
    list.innerHTML = `<div class="empty">Noch keine Statistiken vorhanden.</div>`;
    return;
  }

  const topElo = [...players].sort((a, b) => b.elo - a.elo)[0];
  const mostGames = [...players].sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses))[0];
  const bestWr = [...players]
    .filter(p => p.wins + p.losses > 0)
    .sort((a, b) => parseFloat(winrate(b.wins, b.losses)) - parseFloat(winrate(a.wins, a.losses)))[0];

  list.innerHTML = `
    <div class="stat-grid">
      <div class="stat-box">
        <small>Höchste Elo</small>
        <strong>${escapeHtml(topElo.name)}</strong>
        <div class="player-sub">${topElo.elo} Elo</div>
      </div>
      <div class="stat-box">
        <small>Meiste Spiele</small>
        <strong>${escapeHtml(mostGames.name)}</strong>
        <div class="player-sub">${mostGames.wins + mostGames.losses} Games</div>
      </div>
      <div class="stat-box">
        <small>Beste Winrate</small>
        <strong>${bestWr ? escapeHtml(bestWr.name) : "-"}</strong>
        <div class="player-sub">${bestWr ? winrate(bestWr.wins, bestWr.losses) + "%" : "0.0%"}</div>
      </div>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

loadDashboard();
