const { pg } = require("./database");

let queue3v3 = [];
let queue5v5 = [];
let activeMatches = [];

async function loadActiveMatches() {
    const { rows } = await pg("SELECT * FROM active_matches");
    activeMatches.length = 0;
    for (const match of rows) {
        activeMatches.push({
            ...match,
            teamA: JSON.parse(match.team_a_ids),
            teamB: JSON.parse(match.team_b_ids),
            confirmations: JSON.parse(match.confirmations),
            results: JSON.parse(match.results)
        });
    }
}

function generateSnipingCode() {
    let code;
    do {
        code = Math.floor(Math.random() * 6000) + 4000;
    } while (activeMatches.some(m => m.sniping_code === code));
    return code;
}

function isPlayerInMatch(id, activeMatches) {
    return activeMatches.some(m =>
        m.teamA.some(p => p.id === id) ||
        m.teamB.some(p => p.id === id)
    );
}

function addToQueue(mode, player, activeMatches, onlineUsers) {
    const user = onlineUsers.get(player.id);
    if (!user || user.status !== 'online') return false;

    const alreadyIn3v3 = queue3v3.find(p => p.id === player.id);
    const alreadyIn5v5 = queue5v5.find(p => p.id === player.id);

    if (alreadyIn3v3 || alreadyIn5v5) return false;
    if (isPlayerInMatch(player.id, activeMatches)) return false;

    if (mode === "3v3") queue3v3.push(player);
    if (mode === "5v5") queue5v5.push(player);

    return true;
}

function removeFromQueue(id) {
    const index3 = queue3v3.findIndex(p => p.id === id);
    if (index3 !== -1) queue3v3.splice(index3, 1);

    const index5 = queue5v5.findIndex(p => p.id === id);
    if (index5 !== -1) queue5v5.splice(index5, 1);
}

function returnToQueue(mode, player, priority = false) {
    let queue = mode === "3v3" ? queue3v3 : queue5v5;
    const exists = queue.some(p => p.id === player.id);
    if (exists) return;

    if (priority) {
        queue.unshift(player);
    } else {
        queue.push(player);
    }
}

async function createMatch(mode) {
    let size = mode === "3v3" ? 6 : 10;
    let queue = mode === "3v3" ? queue3v3 : queue5v5;

    if (queue.length < size) return null;

    const players = queue.splice(0, size);
    for (const p of players) removeFromQueue(p.id);

    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const half = size / 2;
    const teamNumber = Math.random() < 0.5 ? 1 : 2;
    const teamA = shuffled.slice(0, half).map(p => ({ ...p, teamNumber }));
    const teamB = shuffled.slice(half).map(p => ({ ...p, teamNumber: teamNumber === 1 ? 2 : 1 }));

    const snipingCode = generateSnipingCode();
    const { rows } = await pg(
        `INSERT INTO active_matches (sniping_code, mode, team_a_ids, team_b_ids, confirmations, results, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING match_id`,
        [snipingCode, mode, JSON.stringify(teamA), JSON.stringify(teamB), JSON.stringify([]), JSON.stringify({}), new Date().toISOString()]
    );

    const match = {
        match_id: rows[0].match_id,
        sniping_code: snipingCode,
        mode,
        teamA,
        teamB,
        confirmations: [],
        results: {},
        created_at: new Date().toISOString()
    };

    activeMatches.push(match);
    return match;
}

async function removeActiveMatch(matchId) {
    await pg("DELETE FROM active_matches WHERE match_id = ?", [matchId]);
    const index = activeMatches.findIndex(m => m.match_id === matchId);
    if (index !== -1) activeMatches.splice(index, 1);
}

async function checkExpiringMatches() {
    const now = new Date();
    const expiredMatches = activeMatches.filter(m => {
        const createdAt = new Date(m.created_at);
        const diffMinutes = (now - createdAt) / (1000 * 60);
        return diffMinutes > 2 && m.confirmations.length < (m.teamA.length + m.teamB.length);
    });

    for (const match of expiredMatches) {
        const totalPlayers = [...match.teamA, ...match.teamB];
        const nonConfirmers = totalPlayers.filter(p => !match.confirmations.includes(p.id));
        const confirmers = totalPlayers.filter(p => match.confirmations.includes(p.id));

        for (const player of nonConfirmers) returnToQueue(match.mode, player, false);
        for (const player of confirmers) returnToQueue(match.mode, player, true);

        await removeActiveMatch(match.match_id);
    }
}

module.exports = {
    queue3v3, queue5v5, activeMatches, loadActiveMatches,
    addToQueue, removeFromQueue, returnToQueue, createMatch,
    removeActiveMatch, checkExpiringMatches
};

// ─── FINALIZAR PARTIDA ────────────────────────────────────────────────────────
const { calculateVGIndex } = require('./ranking');

async function finalizeMatch(match, winnerTeam) {
    const allPlayers = [...match.teamA, ...match.teamB];

    for (const player of allPlayers) {
        const isWinner = player.teamNumber === winnerTeam;

        // Atualiza wins/losses/games
        await pg(
            `UPDATE players SET
                wins  = wins  + ?,
                losses = losses + ?,
                games = games + 1
             WHERE telegram_id = ?`,
            [isWinner ? 1 : 0, isWinner ? 0 : 1, player.id]
        );

        // Recalcula vg_index com base nos novos totais
        const { rows } = await pg(
            'SELECT wins, games FROM players WHERE telegram_id = ?',
            [player.id]
        );
        if (rows[0]) {
            const newIndex = calculateVGIndex(rows[0].wins, rows[0].games);
            await pg(
                'UPDATE players SET vg_index = ? WHERE telegram_id = ?',
                [newIndex, player.id]
            );
        }
    }

    // Salva no histórico de partidas
    await pg(
        `INSERT INTO matches (code, mode, winner_team, created_at, duration_seconds)
         VALUES (?, ?, ?, ?, ?)`,
        [
            match.sniping_code,
            match.mode,
            String(winnerTeam),
            match.created_at,
            match.start_time ? Math.floor((Date.now() - new Date(match.start_time)) / 1000) : 0
        ]
    );

    await removeActiveMatch(match.match_id);
}

module.exports.finalizeMatch = finalizeMatch;
