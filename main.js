const { initDB }    = require('./database');
const { startServer } = require('./server');
const { startBot }    = require('./bot');

async function main() {
    console.log('[MAIN] Iniciando banco de dados...');
    await initDB();

    console.log('[MAIN] Iniciando servidor Mini App...');
    await startServer();

    console.log('[MAIN] Iniciando bot Telegram...');
    await startBot();

    console.log('[MAIN] ✅ Tudo rodando!');
}

main().catch(err => {
    console.error('[MAIN] Erro fatal:', err);
    process.exit(1);
});
