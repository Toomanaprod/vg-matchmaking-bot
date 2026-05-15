
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const path       = require('path');
const cors       = require('cors');

const { pg } = require(path.join(__dirname, 'database'));
const { queue3v3, queue5v5, activeMatches, addToQueue, removeFromQueue, checkExpiringMatches } = require(path.join(__dirname, 'matchmaking'));

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const onlineUsers   = new Map();

function countOnline() {
    const cutoff = Date.now() - 10 * 60 * 1000;
    let count = 0;
    for (const [id, data] of onlineUsers) {
        if (data.timestamp < cutoff) onlineUsers.delete(id);
        else if (data.status === 'online') count++;
    }
    return count;
}

function formatFC(games, vg_index, fraud_penalty_until) {
    if (fraud_penalty_until && new Date(fraud_penalty_until) > new Date()) return '💀';
    if (games < 10) return `${games}/10`;
    return `FC ${Number(vg_index).toFixed(2)}`;
}

async function getGlobalState() {
    const { rows: topPlayers } = await pg(
        'SELECT nickname, wins, losses, games, vg_index, penalty_until, fraud_penalty_until FROM players WHERE games >= 10 ORDER BY vg_index DESC, games DESC LIMIT 10'
    );
    
    // Jogadores expostos por fraude (trolls)
    const { rows: exposedTrolls } = await pg(
        'SELECT nickname, fraud_penalty_until FROM players WHERE fraud_penalty_until > NOW() LIMIT 20'
    );
    
    return {
        online:    countOnline(),
        searching: new Set([...queue3v3.map(p => p.id), ...queue5v5.map(p => p.id)]).size,
        inGame:    activeMatches.length,
        queue3v3:  queue3v3.length,
        queue5v5:  queue5v5.length,
        matches:   activeMatches.map(m => ({
            id: m.match_id, mode: m.mode,
            confirmed: m.confirmations.length,
            total:     m.teamA.length + m.teamB.length,
        })),
        ranking: topPlayers.map((p, i) => ({
            pos: i + 1, nick: p.nickname,
            fc: formatFC(p.games, p.vg_index, p.fraud_penalty_until),
            games: p.games, wins: p.wins, losses: p.losses,
            fraud: !!(p.fraud_penalty_until && new Date(p.fraud_penalty_until) > new Date())
        })),
        exposed: exposedTrolls.map(t => ({ nick: t.nick, until: t.fraud_penalty_until }))
    };
}

async function broadcastState() {
    const state = await getGlobalState();
    io.emit('state_update', state);
}

// ─── API REST ─────────────────────────────────────────────────────────────────
app.get('/api/player/:telegramId', async (req, res) => {
    try {
        const uid = Number(req.params.telegramId);
        const { rows } = await pg('SELECT * FROM players WHERE telegram_id = ?', [uid]);
        if (!rows[0]) return res.status(404).json({ error: 'not_found' });
        const p = rows[0];
        const isFraud = p.fraud_penalty_until && new Date(p.fraud_penalty_until) > new Date();
        
        res.json({
            nick: p.nickname, id: p.telegram_id,
            fc: formatFC(p.games, p.vg_index, p.fraud_penalty_until),
            wins: p.wins, losses: p.losses, games: p.games,
            fraud: isFraud, isAdmin: !!p.is_admin,
            inQueue3v3: queue3v3.some(q => q.id === uid),
            inQueue5v5: queue5v5.some(q => q.id === uid),
            inMatch: activeMatches.some(m => m.teamA.some(pl => pl.id === uid) || m.teamB.some(pl => pl.id === uid))
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/queue/join', async (req, res) => {
    try {
        const { telegramId, mode } = req.body;
        const uid = Number(telegramId);
        const { rows } = await pg('SELECT nickname FROM players WHERE telegram_id = ?', [uid]);
        if (!rows[0]) return res.status(404).json({ error: 'not_registered' });

        onlineUsers.set(uid, { timestamp: Date.now(), status: 'online' });
        addToQueue(mode, { id: uid, name: rows[0].nickname }, activeMatches, onlineUsers);
        await broadcastState();
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/queue/leave', async (req, res) => {
    removeFromQueue(Number(req.body.telegramId));
    await broadcastState();
    res.json({ ok: true });
});

// Loop de verificação
setInterval(async () => {
    await checkExpiringMatches();
    await broadcastState();
}, 30000);

function startServer() {
    return new Promise((resolve) => {
        const PORT = process.env.PORT || 3000;
        server.listen(PORT, () => {
            console.log(`[SERVER] http://localhost:${PORT}`);
            resolve();
        });
    });
}

module.exports = { startServer, broadcastState };
