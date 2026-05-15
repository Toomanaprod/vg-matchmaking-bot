const { Pool } = require("pg");

function parseURL(url) {
    return { connectionString: url, ssl: { rejectUnauthorized: false } };
}

const config = process.env.DATABASE_URL
    ? parseURL(process.env.DATABASE_URL)
    : {
        host:     process.env.DB_HOST     || "localhost",
        port:     Number(process.env.DB_PORT) || 5432,
        user:     process.env.DB_USER     || "postgres",
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_NAME     || "vg_matchmaking",
    };

const pool = new Pool({ ...config, max: 10 });

// Helper: substitui ? por $1, $2, ... (sintaxe pg)
function pg(sql, params = []) {
    let i = 0;
    const query = sql.replace(/\?/g, () => `$${++i}`);
    return pool.query(query, params);
}

async function initDB() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS players (
            telegram_id BIGINT PRIMARY KEY,
            nickname VARCHAR(64),
            wins INT DEFAULT 0,
            losses INT DEFAULT 0,
            games INT DEFAULT 0,
            vg_index DECIMAL(10,2) DEFAULT 1000,
            penalty_until TIMESTAMP DEFAULT NULL,
            fraud_penalty_until TIMESTAMP DEFAULT NULL,
            is_admin BOOLEAN DEFAULT FALSE
        )
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS matches (
            id SERIAL PRIMARY KEY,
            code INT,
            mode VARCHAR(8),
            winner_team VARCHAR(8),
            created_at VARCHAR(64),
            duration_seconds INT DEFAULT 0,
            is_remake BOOLEAN DEFAULT FALSE,
            conflict_report TEXT DEFAULT NULL
        )
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS active_matches (
            match_id SERIAL PRIMARY KEY,
            sniping_code INT,
            mode VARCHAR(8),
            team_a_ids TEXT,
            team_b_ids TEXT,
            confirmations TEXT,
            results TEXT,
            created_at VARCHAR(64),
            start_time VARCHAR(64) DEFAULT NULL
        )
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS reports (
            id SERIAL PRIMARY KEY,
            match_id INT,
            reporter_id BIGINT,
            reason TEXT,
            status VARCHAR(16) DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    console.log("Banco de dados inicializado.");
}

module.exports = { pool, pg, initDB };
