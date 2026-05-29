const SUPABASE_URL = "https://xzegzgckmybaevjdwzti.supabase.co";
const SUPABASE_KEY = "sb_publishable_1GmRO60YM3XW_EaBf8WQrg_rkA9hrFi";

async function supabaseFetch(table) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`
    }
  });

  if (!response.ok) {
    throw new Error(`Supabase Fehler bei ${table}`);
  }

  return await response.json();
}

function rankFromElo(elo) {
  if (elo < 800) return "Leon";
  if (elo < 1000) return "Iron";
  if (elo < 1100) return "Bronze";
  if (elo < 1200) return "Silver";
  if (elo < 1300) return "Gold";
  if (elo < 1400) return "Platin";
  if (elo < 1500) return "Emerald";
  if (elo < 1600) return "Diamond";
  if (elo < 1800) return "Master";
  if (elo < 2000) return "Grandmaster";
  return "Challenger";
}

function winrate(wins, losses) {
  const games = wins + losses;
  if (games === 0) return "0.0";
  return ((wins / games) * 100).toFixed(1);
}

function averageElo(names, playersObj) {
  if (!names || names.length === 0) return 0;
  const sum = names.reduce((acc, name) => acc + (playersObj[name]?.elo ?? 1200), 0);
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
    const playersData = await supabaseFetch("players");
    const matchesData = await supabaseFetch("matches");

    const playersObj = {};
    playersData.forEach(p => {
      playersObj[p.name] = {
        wins: p.wins ?? 0,
        losses: p.losses ?? 0,
        elo: p.elo ?? 1200
      };
    });

    const players = playersData.map(p => ({
      name: p.name,
      wins: p.wins ?? 0,
      losses: p.losses ?? 0,
      elo: p.elo ?? 1200
    }));

    const matches = matchesData
      .map(m => ({
        id: m.id,
        datum: m.datum,
        gewinner: m.winner,
        team1: m.team1 || [],
        team2: m.team2 || []
      }))
      .sort((a, b) => new Date(b.datum) - new Date(a.datum));

    players.sort((a, b) => {
      if (b.elo !== a.elo) return b.elo - a.elo;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.losses - b.losses;
    });

    renderOverview(players, matches);
    renderRanking(players);
    renderMatches(matches, playersObj);
    renderStats(players);
    renderTeammateStats(playersObj, matches);

  } catch (error) {
    console.error(error);

    document.querySelector(".content").innerHTML = `
      <div class="card">
        <h2 style="color:#E11D48">Fehler beim Laden</h2>
        <p>Supabase-Daten konnten nicht geladen werden.</p>
      </div>
    `;
  }
}

function renderOverview(players, matches) {
  const topElo = players.length ? Math.max(...players.map(p => p.elo)) : 0;
  const avgElo = players.length
    ? Math.round(players.reduce((sum, p) => sum + p.elo, 0) / players.length)
    : 0;

  document.getElementById("totalPlayers").textContent = players.length;
  document.getElementById("totalMatches").textContent = matches.length;
  document.getElementById("topElo").textContent = topElo;
  document.getElementById("avgElo").textContent = avgElo;
}

function renderRanking(players) {
  const list = document.getElementById("rankingList");
  list.innerHTML = "";

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

function renderMatches(matches, playersObj) {
  const list = document.getElementById("matchList");
  list.innerHTML = "";

  if (!matches.length) {
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
        <div class="date">${formatDate(match.datum)}</div>
      </div>

      <div class="teams">
        <div class="team ${match.gewinner === "Team 1" ? "winner-team" : "loser-team"}">
          <div class="team-title">Team 1 · Ø ${averageElo(t1, playersObj)} Elo</div>
          <div class="players">${t1.map(escapeHtml).join("<br>") || "Keine Spieler"}</div>
        </div>

        <div class="team ${match.gewinner === "Team 2" ? "winner-team" : "loser-team"}">
          <div class="team-title">Team 2 · Ø ${averageElo(t2, playersObj)} Elo</div>
          <div class="players">${t2.map(escapeHtml).join("<br>") || "Keine Spieler"}</div>
        </div>
      </div>
    `;

    list.appendChild(card);
  });
}

function renderStats(players) {
  const list = document.getElementById("statsList");

  if (!players.length) {
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

function renderTeammateStats(playersObj, matches) {
  const container = document.getElementById("teammateStats");
  if (!container) return;

  container.innerHTML = "";

  const playerNames = Object.keys(playersObj).sort();

  if (!playerNames.length || !matches.length) {
    container.innerHTML = `<div class="empty">Noch keine Mitspieler-Statistiken vorhanden.</div>`;
    return;
  }

  playerNames.forEach(player => {
    const partners = {};

    matches.forEach(match => {
      const team1 = match.team1 || [];
      const team2 = match.team2 || [];
      const winner = match.gewinner;

      let ownTeam = null;
      let won = false;

      if (team1.includes(player)) {
        ownTeam = team1;
        won = winner === "Team 1";
      } else if (team2.includes(player)) {
        ownTeam = team2;
        won = winner === "Team 2";
      }

      if (!ownTeam) return;

      ownTeam.forEach(partner => {
        if (partner === player) return;

        if (!partners[partner]) {
          partners[partner] = { games: 0, wins: 0, losses: 0 };
        }

        partners[partner].games++;

        if (won) partners[partner].wins++;
        else partners[partner].losses++;
      });
    });

    const partnerList = Object.entries(partners).map(([name, stats]) => {
      const wr = stats.games > 0 ? (stats.wins / stats.games) * 100 : 0;

      return {
        name,
        games: stats.games,
        wins: stats.wins,
        losses: stats.losses,
        wr
      };
    });

    if (!partnerList.length) return;

    const byGames = [...partnerList].sort((a, b) => {
      if (b.games !== a.games) return b.games - a.games;
      return b.wr - a.wr;
    });

    const byWinrate = [...partnerList].sort((a, b) => {
      if (b.wr !== a.wr) return b.wr - a.wr;
      return b.games - a.games;
    });

    const details = document.createElement("details");
    details.className = "teammate-details";

    details.innerHTML = `
      <summary class="teammate-summary">
        <span>${escapeHtml(player)}</span>
        <small>${partnerList.length} Mitspieler</small>
      </summary>

      <div class="teammate-columns">
        <div class="teammate-column">
          <h3>Am häufigsten gespielt mit</h3>
          ${renderPartnerRows(byGames, "games")}
        </div>

        <div class="teammate-column">
          <h3>Höchste Winrate mit</h3>
          ${renderPartnerRows(byWinrate, "winrate")}
        </div>
      </div>
    `;

    container.appendChild(details);
  });
}

function renderPartnerRows(list, mode = "winrate") {
  return list.map((item, index) => {
    const isGamesMode = mode === "games";
    const mainValue = isGamesMode ? `${item.games}x` : `${item.wr.toFixed(1)}%`;
    const valueClass = isGamesMode ? "games" : (item.wr >= 50 ? "good" : "bad");

    return `
      <div class="partner-row">
        <div class="partner-place">${index + 1}</div>

        <div class="partner-main">
          <strong>${escapeHtml(item.name)}</strong>
          <span>${item.games} Spiele · ${item.wins}-${item.losses} · ${item.wr.toFixed(1)}% WR</span>
        </div>

        <div class="partner-wr ${valueClass}">
          ${mainValue}
        </div>
      </div>
    `;
  }).join("");
}

function formatDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return escapeHtml(value);
  }

  return date.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
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
