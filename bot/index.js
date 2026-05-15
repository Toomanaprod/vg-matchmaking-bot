
const { Telegraf, Markup } = require('telegraf');

const { pg } = require('../database');

// ─── UTILS ────────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function sanitizeInput(text) { return String(text || '').replace(/[<>"\']/g, '').trim(); }

// ─── HANDLERS ─────────────────────────────────────────────────────────────────
function setupHandlers(bot) {
    const pendingNick = new Set();

    // /start - Tutorial e botão WebApp
    bot.start(async (ctx) => {
        console.log(`[BOT] /start recebido de ${ctx.from.id}`);
        try {
            const { rows } = await pg('SELECT * FROM players WHERE telegram_id = ?', [ctx.from.id]);
            if (!rows[0]) {
                pendingNick.add(ctx.from.id);
                return ctx.reply('👋 Bem-vindo ao VG Matchmaking BR!\n\nDigite seu nick para começar (3-16 caracteres):');
            }
            await sendAppPortal(ctx);
        } catch (err) {
            console.error(`[BOT] Erro em /start:`, err);
            ctx.reply('❌ Erro ao processar seu comando.');
        }
    });

    // /tutorial e /saguao (Alias para o portal)
    bot.command(['tutorial', 'saguao'], async (ctx) => {
        console.log(`[BOT] /${ctx.message.text.split(' ')[0].replace('/','')} recebido de ${ctx.from.id}`);
        await sendAppPortal(ctx);
    });

    // /changenick - Muda o apelido do jogador
    bot.command('changenick', async (ctx) => {
        console.log(`[BOT] /changenick recebido de ${ctx.from.id}`);
        try {
            const newNick = sanitizeInput(ctx.message.text.split(' ').slice(1).join(' '));
            if (!newNick) return ctx.reply('Uso: /changenick NovoNick');
            if (newNick.length < 3 || newNick.length > 16) return ctx.reply('Nick deve ter entre 3 e 16 caracteres.');

            const { rows: [existing] } = await pg('SELECT * FROM players WHERE nickname = ?', [newNick]);
            if (existing) return ctx.reply('Este nick já está em uso.');

            await pg('UPDATE players SET nickname = ? WHERE telegram_id = ?', [newNick, ctx.from.id]);
            ctx.reply(`✅ Seu nick foi alterado para <b>${newNick}</b>!`, { parse_mode: 'HTML' });
        } catch (err) {
            ctx.reply('❌ Erro ao alterar nick.');
        }
    });

    // /report id_partida - Gera relatório de análise
    bot.command('report', async (ctx) => {
        console.log(`[BOT] /report recebido de ${ctx.from.id}`);
        try {
            const matchId = ctx.message.text.split(' ')[1];
            if (!matchId) return ctx.reply('Uso: /report ID_DA_PARTIDA');

            await pg(
                'INSERT INTO reports (match_id, reporter_id, reason) VALUES (?, ?, ?)',
                [matchId, ctx.from.id, 'Relatório de análise solicitado pelo jogador.']
            );
            ctx.reply(`✅ Relatório da partida #${matchId} enviado para análise administrativa.`);
        } catch (err) {
            ctx.reply('❌ Erro ao enviar relatório.');
        }
    });

    // /relatorio - Apenas para admins
    bot.command('relatorio', async (ctx) => {
        console.log(`[BOT] /relatorio recebido de ${ctx.from.id}`);
        try {
            const { rows: [adminCheck] } = await pg('SELECT is_admin FROM players WHERE telegram_id = ?', [ctx.from.id]);
            if (!adminCheck[0]?.is_admin) return ctx.reply('Comando restrito a administradores.');

            const { rows: reports } = await pg('SELECT * FROM reports WHERE status = "pending" LIMIT 5');
            if (reports.length === 0) return ctx.reply('Nenhum relatório pendente.');

            for (const report of reports) {
                const { rows: [match] } = await pg('SELECT * FROM active_matches WHERE match_id = ?', [report.match_id]);
                if (!match[0]) continue;

                const teamA = JSON.parse(match[0].team_a_ids);
                const teamB = JSON.parse(match[0].team_b_ids);
                const allPlayers = [...teamA, ...teamB];

                const buttons = allPlayers.map(p => [
                    Markup.button.callback(`Punir ${p.name}`, `punish_${p.id}_${report.id}`),
                    Markup.button.callback(`Inocentar ${p.name}`, `clear_${p.id}_${report.id}`)
                ]);

                await ctx.reply(
                    `🚩 <b>Relatório #${report.id} - Partida #${report.match_id}</b>\nMotivo: ${report.reason}`,
                    { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) }
                );
            }
        } catch (err) {
            ctx.reply('❌ Erro ao buscar relatórios.');
        }
    });

    // Callbacks
    bot.action(/punish_(\d+)_(\d+)/, async (ctx) => {
        const targetId = ctx.match[1];
        const reportId = ctx.match[2];
        const fraudUntil = new Date();
        fraudUntil.setDate(fraudUntil.getDate() + 7);
        await pg(
            'UPDATE players SET fraud_penalty_until = ?, losses = losses + 2, games = games + 2 WHERE telegram_id = ?',
            [fraudUntil.toISOString().slice(0, 19).replace('T', ' '), targetId]
        );
        await pg('UPDATE reports SET status = "resolved" WHERE id = ?', [reportId]);
        ctx.answerCbQuery('Punição aplicada.');
        ctx.editMessageText('✅ Punição aplicada com sucesso.');
    });

    bot.action(/clear_(\d+)_(\d+)/, async (ctx) => {
        const reportId = ctx.match[2];
        await pg('UPDATE reports SET status = "resolved" WHERE id = ?', [reportId]);
        ctx.answerCbQuery('Relatório arquivado.');
        ctx.editMessageText('✅ Relatório arquivado.');
    });

    // Registro de Nick
    bot.on('text', async (ctx, next) => {
        if (!pendingNick.has(ctx.from.id)) return next();
        const nick = sanitizeInput(ctx.message.text);
        if (nick.startsWith('/')) return next();
        if (nick.length < 3 || nick.length > 16) return ctx.reply('Nick inválido (3-16 caracteres):');

        const { rows: [existing] } = await pg('SELECT * FROM players WHERE nickname = ?', [nick]);
        if (existing) return ctx.reply('Este nick já está em uso:');

        await pg('INSERT INTO players (telegram_id, nickname) VALUES (?, ?)', [ctx.from.id, nick]);
        pendingNick.delete(ctx.from.id);
        await ctx.reply(`✅ Nick <b>${nick}</b> registrado!`, { parse_mode: 'HTML' });
        await sleep(500);
        await sendAppPortal(ctx);
    });
}

async function sendAppPortal(ctx) {
    console.log(`[BOT] Enviando portal para ${ctx.from.id}...`);
    let WEBAPP_URL = process.env.WEBAPP_URL;
    if (WEBAPP_URL && WEBAPP_URL.startsWith('http://')) {
        WEBAPP_URL = WEBAPP_URL.replace('http://', 'https://');
    }
    const keyboard = WEBAPP_URL ? Markup.inlineKeyboard([[Markup.button.webApp('🎮 Abrir VG Matchmaking', WEBAPP_URL)]]) : {};

    const tutorial = 
        '⚡ <b>VG Matchmaking BR</b>\n\n' +
        '📖 <b>COMO USAR:</b>\n\n' +
        '1️⃣ <b>Escolha a Fila</b>\n' +
        '   🎯 <b>3v3 Ranked</b> — Competitivo, ganha/perde FC\n' +
        '   🔥 <b>5v5 Casual</b> — Sem pontos, apenas diversão\n\n' +
        '2️⃣ <b>Aguarde a Partida</b>\n' +
        '   Quando 6 ou 10 jogadores forem encontrados, você receberá:\n' +
        '   • ID da partida (#XXXXX)\n' +
        '   • Sniping Code (ex: VG-1_)\n' +
        '   • Nomes dos seus aliados\n\n' +
        '3️⃣ <b>Mude Seu Nick</b>\n' +
        '   Antes de entrar no jogo, mude seu nick para:\n' +
        '   <code>SNIPING_CODE-NUMERO_SeuNick</code>\n' +
        '   Exemplo: <code>VG-1_Seu_Nick</code>\n\n' +
        '4️⃣ <b>Jogue!</b>\n' +
        '   Encontre seus aliados (mesma cor) e vença!\n\n' +
        '💡 <b>DICAS:</b>\n' +
        '   • Fique <b>Online</b> para ser encontrado\n' +
        '   • Clique em <b>Ausente</b> se precisar sair\n' +
        '   • Veja seu <b>Perfil</b> e <b>Ranking</b>\n' +
        '   • Use <code>/changenick</code> para mudar o nome\n\n' +
        '🚀 <b>Pronto? Toque no botão abaixo!</b>';

    try {
        await ctx.reply(tutorial, { parse_mode: 'HTML', ...keyboard });
    } catch (err) {
        console.error(`[BOT] Erro ao enviar portal:`, err);
    }
}

async function startBot() {
    const BOT_TOKEN = process.env.BOT_TOKEN;
    if (!BOT_TOKEN) return console.error('[BOT] ❌ BOT_TOKEN não configurado.');
    const bot = new Telegraf(BOT_TOKEN);
    
    setupHandlers(bot);
    
    // Registrar comandos no menu do Telegram
    try {
        await bot.telegram.setMyCommands([
            { command: 'start', description: 'Iniciar o bot e abrir o app' },
            { command: 'saguao', description: 'Abrir o Mini App' },
            { command: 'tutorial', description: 'Ver como jogar' },
            { command: 'changenick', description: 'Mudar seu apelido' },
            { command: 'report', description: 'Reportar uma partida (#id)' },
            { command: 'relatorio', description: 'Ver relatórios (Admin)' }
        ]);
        console.log('[BOT] ✅ Comandos registrados no Telegram!');
    } catch (err) {
        console.error('[BOT] ❌ Erro ao registrar comandos:', err);
    }

    bot.launch();
    console.log('[BOT] ✅ Bot iniciado e aguardando mensagens...');
}

module.exports = { startBot };
