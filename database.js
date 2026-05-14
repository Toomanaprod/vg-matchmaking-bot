const mysql = require("mysql2/promise");

function parseURL(url) {
    const u = new URL(url);
    return {
        host:     u.hostname,
        port:     Number(u.port) || 3306,
        user:     u.username,
        password: u.password,
        database: u.pathname.replace("/", ""),
    };
}

const config = process.env.DATABASE_URL
    ? parseURL(process.env.DATABASE_URL)
    : {
        host:     process.env.DB_HOST     || "localhost",
        port:     Number(process.env.DB_PORT) || 3306,
        user:     process.env.DB_USER     || "root",
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_NAME     || "vg_matchmaking",
    };

const pool = mysql.createPool({
    ...config,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

async function initDB() {
    await pool.execute(`
        CREATE TABLE IF NOT EXISTS players (
            telegram_id BIGINT PRIMARY KEY,
            nickname VARCHAR(64),
            wins INT DEFAULT 0,
            losses INT DEFAULT 0,
            games INT DEFAULT 0,
            vg_index DECIMAL(10,2) DEFAULT 1000,
            penalty_until DATETIME DEFAULT NULL,
            fraud_penalty_until DATETIME DEFAULT NULL,
            is_admin BOOLEAN DEFAULT FALSE
        )
    `);
    await pool.execute(`
        CREATE TABLE IF NOT EXISTS matches (
            id INT AUTO_INCREMENT PRIMARY KEY,
            code INT,
            mode VARCHAR(8),
            winner_team VARCHAR(8),
            created_at VARCHAR(64),
            duration_seconds INT DEFAULT 0,
            is_remake BOOLEAN DEFAULT FALSE,
            conflict_report TEXT DEFAULT NULL
        )
    `);
    await pool.execute(`
        CREATE TABLE IF NOT EXISTS active_matches (
            match_id INT AUTO_INCREMENT PRIMARY KEY,
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
    await pool.execute(`
        CREATE TABLE IF NOT EXISTS reports (
            id INT AUTO_INCREMENT PRIMARY KEY,
            match_id INT,
            reporter_id BIGINT,
            reason TEXT,
            status ENUM('pending', 'resolved') DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await pool.execute(`
        CREATE TABLE IF NOT EXISTS news (
            id INT AUTO_INCREMENT PRIMARY KEY,
            content TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await pool.execute(`
        CREATE TABLE IF NOT EXISTS events (
            id INT AUTO_INCREMENT PRIMARY KEY,
            content TEXT,
            event_time DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    console.log("Banco de dados inicializado.");
}

module.exports = { pool, initDB };
