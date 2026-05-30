const SUPABASE_URL = "https://xzegzgckmybaevjdwzti.supabase.co";
const SUPABASE_KEY = "sb_publishable_1GmRO60YM3XW_EaBf8WQrg_rkA9hrFi";
const RIOT_API_KEY = "RGAPI-77fe1f07-5cb8-4cf4-b08c-c36aecc0386e";

const ADMIN_PASSWORD = "kotbatzen";

let isAdmin = false;
let currentPlayers = [];
let currentPlayersObj = {};
let currentMatches = [];
let generatedTeam1 = [];
let generatedTeam2 = [];
let DDRAGON_VERSION = "15.12.1";

async function loadDDragonVersion() {
  try {
    const response = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
    const versions = await response.json();

    if (Array.isArray(versions) && versions.length > 0) {
      DDRAGON_VERSION = versions[0];
    }
  } catch (error) {
    console.warn("Data Dragon Version konnte nicht geladen werden, nutze Fallback:", DDRAGON_VERSION);
  }
}

function getProfileIconUrl(iconId) {
  if (iconId === null || iconId === undefined || iconId === "") {
    return "summoner_icons/default.png";
  }

  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/${Number(iconId)}.png`;
}

async function getRiotProfileData(gameName, tagLine) {
  const accountResponse = await fetch(
    `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
    {
      headers: {
        "X-Riot-Token": RIOT_API_KEY
      }
    }
  );

  if (!accountResponse.ok) {
    throw new Error("Riot Account wurde nicht gefunden.");
  }

  const accountData = await accountResponse.json();

  const summonerResponse = await fetch(
    `https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(accountData.puuid)}`,
    {
      headers: {
        "X-Riot-Token": RIOT_API_KEY
      }
    }
  );

  if (!summonerResponse.ok) {
    throw new Error("Summoner-Daten konnten nicht geladen werden.");
  }

  const summonerData = await summonerResponse.json();

  return {
    puuid: accountData.puuid,
    gameName: accountData.gameName,
    tagLine: accountData.tagLine,
    profileIconId: summonerData.profileIconId
  };
}

async function supabaseFetch(table) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`
    }
  });

  if (!response.ok) throw new Error(`Supabase Fehler bei ${table}`);
  return await response.json();
}

async function supabaseInsert(table, data) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) throw new Error(`Insert Fehler bei ${table}`);
  return await response.json();
}

async function supabaseUpdatePlayer(name, data) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/players?name=eq.${encodeURIComponent(name)}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) throw new Error(`Update Fehler bei ${name}`);
}

async function supabaseDeleteMatch(matchId) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/matches?id=eq.${encodeURIComponent(matchId)}`,
    {
      method: "DELETE",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Prefer: "return=representation"
      }
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Delete Fehler:", errorText);
    throw new Error("Match konnte nicht gelöscht werden.");
  }

  const deletedRows = await response.json();

  if (!deletedRows || deletedRows.length === 0) {
    throw new Error("Kein Match gelöscht. Prüfe ID oder Supabase DELETE Policy.");
  }

  return deletedRows;
}

async function addPlayer() {
  if (!isAdmin) {
    alert("Nur im Admin-Modus möglich.");
    return;
  }

  const input = document.getElementById("newPlayerName");
  const name = input.value.trim();

  if (!name) {
    alert("Bitte einen Namen eingeben.");
    return;
  }

  if (currentPlayersObj[name]) {
    alert("Spieler existiert bereits.");
    return;
  }

  try {
    await supabaseInsert("players", {
      name,
      wins: 0,
      losses: 0,
      elo: 1200,
      riot_game_name: null,
      riot_tag_line: null,
      riot_puuid: null,
      profile_icon_id: null
    });

    input.value = "";

    await loadDashboard();

    alert(`${name} wurde hinzugefügt.`);
  } catch (error) {
    console.error(error);
    alert("Spieler konnte nicht angelegt werden.");
  }
}

async function attachRiotAccount(playerName) {
  if (!isAdmin) {
    alert("Nur im Admin-Modus möglich.");
    return;
  }

  const gameName = prompt(`Riot Name für ${playerName}:`);
  if (!gameName) return;

  const tagLine = prompt(`Tag für ${gameName}, z.B. EUW:`);
  if (!tagLine) return;

  try {
    const riotData = await getRiotProfileData(gameName.trim(), tagLine.trim());

    await supabaseUpdatePlayer(playerName, {
      riot_game_name: riotData.gameName,
      riot_tag_line: riotData.tagLine,
      riot_puuid: riotData.puuid,
      profile_icon_id: riotData.profileIconId
    });

    await loadDashboard();

    alert(`Summoner Icon für ${playerName} wurde gespeichert.`);
  } catch (error) {
    console.error(error);
    alert("Riot Account konnte nicht gefunden oder gespeichert werden.");
  }
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

function teamChances(team1, team2) {
  const elo1 = averageElo(team1, currentPlayersObj);
  const elo2 = averageElo(team2, currentPlayersObj);

  if (!team1.length || !team2.length) return [0, 0];

  const chance1 = Math.round((elo1 / (elo1 + elo2)) * 1000) / 10;
  const chance2 = Math.round((100 - chance1) * 10) / 10;

  return [chance1, chance2];
}

function medal(place) {
  if (place === 1) return "🥇";
  if (place === 2) return "🥈";
  if (place === 3) return "🥉";
  return place;
}

async function loadDashboard() {
  const playersData = await supabaseFetch("players");
  const matchesData = await supabaseFetch("matches");

  currentPlayersObj = {};
  playersData.forEach(p => {
    currentPlayersObj[p.name] = {
      wins: p.wins ?? 0,
      losses: p.losses ?? 0,
      elo: p.elo ?? 1200,
      profile_icon_id: p.profile_icon_id ?? null,
      riot_game_name: p.riot_game_name ?? null,
      riot_tag_line: p.riot_tag_line ?? null,
      riot_puuid: p.riot_puuid ?? null
    };
  });

  currentPlayers = playersData.map(p => ({
    name: p.name,
    wins: p.wins ?? 0,
    losses: p.losses ?? 0,
    elo: p.elo ?? 1200,
    profile_icon_id: p.profile_icon_id ?? null,
    riot_game_name: p.riot_game_name ?? null,
    riot_tag_line: p.riot_tag_line ?? null,
    riot_puuid: p.riot_puuid ?? null
  }));

  currentMatches = matchesData
    .map(m => ({
      id: m.id,
      datum: m.datum,
      gewinner: m.winner,
      team1: m.team1 || [],
      team2: m.team2 || []
    }))
    .sort((a, b) => new Date(b.datum) - new Date(a.datum));

  currentPlayers.sort((a, b) => {
    if (b.elo !== a.elo) return b.elo - a.elo;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.losses - b.losses;
  });

  renderOverview(currentPlayers, currentMatches);
  renderPlayerSelection(currentPlayers);
  renderRanking(currentPlayers);
  renderMatches(currentMatches, currentPlayersObj);
  renderStats(currentPlayers);
  renderTeammateStats(currentPlayersObj, currentMatches);
}

function renderOverview(players, matches) {
  const topElo = players.length ? Math.max(...players.map(p => p.elo)) : 0;
  const avgElo = players.length ? Math.round(players.reduce((sum, p) => sum + p.elo, 0) / players.length) : 0;

  document.getElementById("totalPlayers").textContent = players.length;
  document.getElementById("totalMatches").textContent = matches.length;
  document.getElementById("topElo").textContent = topElo;
  document.getElementById("avgElo").textContent = avgElo;
}

function renderPlayerSelection(players) {
  const list = document.getElementById("playerSelectList");
  if (!list) return;

  list.innerHTML = "";

  players.forEach(player => {
    const label = document.createElement("label");
    label.className = "player-check";

    label.innerHTML = `
      <input type="checkbox" value="${escapeHtml(player.name)}">

      <span class="custom-check"></span>

      <span class="player-card-name">
        <img
            class="summoner-icon rank-${rankFromElo(player.elo).toLowerCase()}"
            src="${getProfileIconUrl(player.profile_icon_id)}"
            alt=""
          >
        <span>${escapeHtml(player.name)}</span>
      </span>

      <span class="player-card-elo">${player.elo} Elo</span>

      <span class="player-card-wr">${winrate(player.wins, player.losses)}% WR</span>

      ${
        isAdmin
          ? `<button type="button" class="riot-link-btn" onclick="event.preventDefault(); event.stopPropagation(); attachRiotAccount('${escapeJs(player.name)}')">🔗</button>`
          : ""
      }
    `;

    list.appendChild(label);
  });
}

function getSelectedPlayers() {
  return Array.from(document.querySelectorAll("#playerSelectList input:checked"))
    .map(cb => cb.value);
}

function generateTeams() {
  const selected = getSelectedPlayers();

  if (selected.length < 2) {
    alert("Bitte mindestens 2 Spieler auswählen.");
    return;
  }

  const shuffled = [...selected];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const splitPoint = Math.ceil(shuffled.length / 2);

  generatedTeam1 = shuffled.slice(0, splitPoint);
  generatedTeam2 = shuffled.slice(splitPoint);

  renderGeneratedTeams();
}
function generateFairTeams() {
  const selected = getSelectedPlayers();

  if (selected.length < 2) {
    alert("Bitte mindestens 2 Spieler auswählen.");
    return;
  }

  const players = selected
    .map(name => ({
      name,
      elo: currentPlayersObj[name]?.elo ?? 1200
    }))
    .sort((a, b) => b.elo - a.elo);

  generatedTeam1 = [];
  generatedTeam2 = [];

  let elo1 = 0;
  let elo2 = 0;

  for (const player of players) {
    if (elo1 <= elo2) {
      generatedTeam1.push(player.name);
      elo1 += player.elo;
    } else {
      generatedTeam2.push(player.name);
      elo2 += player.elo;
    }
  }

  renderGeneratedTeams();
}
let teamGenerationTimerIds = [];
let isGeneratingTeams = false;

function renderGeneratedTeams() {
  const team1List = document.getElementById("team1List");
  const team2List = document.getElementById("team2List");
  const team1Chance = document.getElementById("team1Chance");
  const team2Chance = document.getElementById("team2Chance");
  const generateBtn = document.getElementById("generateTeamsBtn");
  const fairGenerateBtn = document.getElementById("generateFairTeamsBtn");

  teamGenerationTimerIds.forEach(id => clearTimeout(id));
  teamGenerationTimerIds = [];

  if (isGeneratingTeams) return;
  isGeneratingTeams = true;

  generateBtn.disabled = true;
  fairGenerateBtn.disabled = true;

  const [c1, c2] = teamChances(generatedTeam1, generatedTeam2);

  team1Chance.textContent = `${c1}% Gewinnchance`;
  team2Chance.textContent = `${c2}% Gewinnchance`;

  function createGeneratedPlayerHTML(name) {
    const p = currentPlayersObj[name];

    return `
      <div class="generated-player reveal-player">
        <img
          class="generated-icon rank-${rankFromElo(p?.elo ?? 1200).toLowerCase()}"
          src="${getProfileIconUrl(p?.profile_icon_id)}"
          alt=""
        >
        <span>${escapeHtml(name)}</span>
        <span class="generated-player-elo">
          ${p?.elo ?? 1200} Elo
        </span>
      </div>
    `;
  }

  team1List.innerHTML = "";
  team2List.innerHTML = "";

  const picks = [];
  const maxPlayers = Math.max(generatedTeam1.length, generatedTeam2.length);

  for (let i = 0; i < maxPlayers; i++) {
    if (generatedTeam1[i]) picks.push({ list: team1List, name: generatedTeam1[i] });
    if (generatedTeam2[i]) picks.push({ list: team2List, name: generatedTeam2[i] });
  }

  picks.forEach((pick, index) => {
    const timerId = setTimeout(() => {
      pick.list.insertAdjacentHTML(
        "beforeend",
        createGeneratedPlayerHTML(pick.name)
      );

      if (index === picks.length - 1) {
        isGeneratingTeams = false;
        generateBtn.disabled = false;
        fairGenerateBtn.disabled = false;
      }
    }, index * 500);

    teamGenerationTimerIds.push(timerId);
  });
}
  let index = 0;

  const interval = setInterval(() => {
    if (index >= picks.length) {
      clearInterval(interval);
      return;
    }

    picks[index].list.insertAdjacentHTML(
      "beforeend",
      createGeneratedPlayerHTML(picks[index].name)
    );

    index++;
  }, 500);
}

async function saveResult(winningTeamNumber) {
  if (!generatedTeam1.length || !generatedTeam2.length) {
    alert("Bitte zuerst Teams generieren.");
    return;
  }

  const winners = winningTeamNumber === 1 ? generatedTeam1 : generatedTeam2;
  const losers = winningTeamNumber === 1 ? generatedTeam2 : generatedTeam1;
  const winnerText = winningTeamNumber === 1 ? "Team 1" : "Team 2";

  try {
    for (const name of winners) {
      const p = currentPlayersObj[name];
      await supabaseUpdatePlayer(name, {
        wins: p.wins + 1,
        elo: p.elo + 30
      });
    }

    for (const name of losers) {
      const p = currentPlayersObj[name];
      await supabaseUpdatePlayer(name, {
        losses: p.losses + 1,
        elo: p.elo - 30
      });
    }

    await supabaseInsert("matches", {
      winner: winnerText,
      team1: generatedTeam1,
      team2: generatedTeam2
    });

    alert(`${winnerText} wurde gespeichert.`);

    generatedTeam1 = [];
    generatedTeam2 = [];
    renderGeneratedTeams();

    await loadDashboard();
  } catch (error) {
    console.error(error);
    alert("Fehler beim Speichern des Ergebnisses.");
  }
}

function adminLogin() {
  const input = prompt("Admin-Passwort:");

  if (input === ADMIN_PASSWORD) {
    isAdmin = true;
    alert("Admin-Modus aktiviert.");
    loadDashboard();
  } else {
    alert("Falsches Passwort.");
  }
}

async function deleteMatch(matchId) {
  if (!isAdmin) {
    alert("Nur im Admin-Modus möglich.");
    return;
  }

  const match = currentMatches.find(m => String(m.id) === String(matchId));

  if (!match) {
    alert("Match wurde nicht gefunden.");
    return;
  }

  const ok = confirm("Dieses Match wirklich löschen? Wins, Losses und Elo werden zurückgerechnet.");
  if (!ok) return;

  const winners = match.gewinner === "Team 1" ? match.team1 : match.team2;
  const losers = match.gewinner === "Team 1" ? match.team2 : match.team1;

  try {
    await supabaseDeleteMatch(matchId);

    for (const name of winners) {
      const p = currentPlayersObj[name];
      if (!p) continue;

      await supabaseUpdatePlayer(name, {
        wins: Math.max(0, p.wins - 1),
        elo: p.elo - 30
      });
    }

    for (const name of losers) {
      const p = currentPlayersObj[name];
      if (!p) continue;

      await supabaseUpdatePlayer(name, {
        losses: Math.max(0, p.losses - 1),
        elo: p.elo + 30
      });
    }

    alert("Match wurde gelöscht und die Statistik wurde zurückgerechnet.");
    await loadDashboard();
  } catch (error) {
    console.error(error);
    alert("Fehler beim Löschen des Matches.");
  }
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
        <img
          class="summoner-icon-small rank-${rank.toLowerCase()}"
          src="${getProfileIconUrl(p.profile_icon_id)}"
          alt=""
        >
      </div>

      <div>
        <div class="ranking-player">
          <span class="player-name">${escapeHtml(p.name)}</span>
        </div>
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

        <div style="display:flex; gap:10px; align-items:center;">
          <div class="date">${formatDate(match.datum)}</div>

          ${
            isAdmin
              ? `<button class="delete-match-btn" onclick="deleteMatch('${match.id}')">🗑️ Löschen</button>`
              : ""
          }
        </div>
      </div>

      <div class="teams">
        <div class="team ${match.gewinner === "Team 1" ? "winner-team" : "loser-team"}">
          <div class="team-title">Team 1 · Ø ${averageElo(t1, playersObj)} Elo</div>
          <div class="players">
  ${t1.map(name => {
    const p = playersObj[name];

    return `
      <div class="match-player">
        <img
          class="match-player-icon rank-${rankFromElo(p?.elo ?? 1200).toLowerCase()}"
          src="${getProfileIconUrl(p?.profile_icon_id)}"
          alt=""
        >
        <span>${escapeHtml(name)}</span>
      </div>
    `;
  }).join("")}
</div>
        </div>

        <div class="team ${match.gewinner === "Team 2" ? "winner-team" : "loser-team"}">
          <div class="team-title">Team 2 · Ø ${averageElo(t2, playersObj)} Elo</div>
          <div class="players">
  ${t2.map(name => {
    const p = playersObj[name];

    return `
      <div class="match-player">
        <img
          class="match-player-icon rank-${rankFromElo(p?.elo ?? 1200).toLowerCase()}"
          src="${getProfileIconUrl(p?.profile_icon_id)}"
          alt=""
        >
        <span>${escapeHtml(name)}</span>
      </div>
    `;
  }).join("")}
</div>
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

  Object.keys(playersObj).sort().forEach(player => {
    const partners = {};
    const enemies = {};

    matches.forEach(match => {
      const team = match.team1.includes(player)
        ? match.team1
        : match.team2.includes(player)
          ? match.team2
          : null;

      const enemyTeam = match.team1.includes(player)
        ? match.team2
        : match.team2.includes(player)
          ? match.team1
          : null;

      const won = match.team1.includes(player)
        ? match.gewinner === "Team 1"
        : match.gewinner === "Team 2";

      if (team) {
        team.forEach(partner => {
          if (partner === player) return;
          if (!partners[partner]) partners[partner] = { games: 0, wins: 0, losses: 0 };
          partners[partner].games++;
          if (won) partners[partner].wins++;
          else partners[partner].losses++;
        });
      }

      if (enemyTeam) {
        enemyTeam.forEach(enemy => {
          if (!enemies[enemy]) enemies[enemy] = 0;
          enemies[enemy]++;
        });
      }
    });

    const partnerList = Object.entries(partners).map(([name, s]) => ({
      name,
      games: s.games,
      wins: s.wins,
      losses: s.losses,
      wr: s.games ? (s.wins / s.games) * 100 : 0
    }));

    if (!partnerList.length) return;

    const byGames = [...partnerList].sort((a, b) => b.games - a.games || b.wr - a.wr);
    const byWinrate = [...partnerList].sort((a, b) => b.wr - a.wr || b.games - a.games);
    const byEnemies = Object.entries(enemies)
      .map(([name, games]) => ({ name, games }))
      .sort((a, b) => b.games - a.games || a.name.localeCompare(b.name));

    const details = document.createElement("details");
    details.className = "teammate-details";

    details.innerHTML = `
      <summary class="teammate-summary">
        <span>${escapeHtml(player)}</span>
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

        <div class="teammate-column">
          <h3>Am häufigsten gespielt gegen</h3>
          ${renderEnemyRows(byEnemies)}
        </div>
      </div>
    `;

    container.appendChild(details);
  });
}

function renderPartnerRows(list, mode) {
  return list.map((item, index) => {
    const value = mode === "games" ? `${item.games}x` : `${item.wr.toFixed(1)}%`;
    const cls = mode === "games" ? "games" : item.wr >= 50 ? "good" : "bad";

    return `
      <div class="partner-row">
        <div class="partner-place">${index + 1}</div>

        <div class="partner-main">
          <strong>${escapeHtml(item.name)}</strong>
          <span>${item.games} Spiele · ${item.wins}-${item.losses} · ${item.wr.toFixed(1)}% WR</span>
        </div>

        <div class="partner-wr ${cls}">${value}</div>
      </div>
    `;
  }).join("");
}

function renderEnemyRows(list) {
  return list.map((item, index) => {
    return `
      <div class="partner-row">
        <div class="partner-place">${index + 1}</div>

        <div class="partner-main">
          <strong>${escapeHtml(item.name)}</strong>
          <span>${item.games} Spiele gegeneinander</span>
        </div>

        <div class="partner-wr games">
          ${item.games}x
        </div>
      </div>
    `;
  }).join("");
}

function bindButtons() {
  document.getElementById("adminBtn")?.addEventListener("click", adminLogin);
  document.getElementById("addPlayerBtn")?.addEventListener("click", addPlayer);

  document.getElementById("selectAllBtn")?.addEventListener("click", () => {
    document.querySelectorAll("#playerSelectList input").forEach(cb => cb.checked = true);
  });

  document.getElementById("clearSelectionBtn")?.addEventListener("click", () => {
    document.querySelectorAll("#playerSelectList input").forEach(cb => cb.checked = false);
  });

  document.getElementById("generateTeamsBtn")?.addEventListener("click", generateTeams);
  document.getElementById("generateFairTeamsBtn")?.addEventListener("click", generateFairTeams);
  document.getElementById("team1WinBtn")?.addEventListener("click", () => saveResult(1));
  document.getElementById("team2WinBtn")?.addEventListener("click", () => saveResult(2));
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
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

function escapeJs(value) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
    .replaceAll('"', '\\"')
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\r");
}

bindButtons();

loadDDragonVersion().then(() => {
  loadDashboard();
});
