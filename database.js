const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'photos.db');

// Создание и подключение к базе данных
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Ошибка подключения к БД:', err.message);
    } else {
        console.log('Подключение к SQLite установлено');
        initDatabase();
    }
});

// Инициализация таблиц
function initDatabase() {
    db.run(`
        CREATE TABLE IF NOT EXISTS photos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            original_name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_size INTEGER,
            mime_type TEXT,
            upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            description TEXT,
            tags TEXT,
            is_public BOOLEAN DEFAULT 1
        )
    `, (err) => {
        if (err) {
            console.error('Ошибка создания таблицы:', err);
        } else {
            console.log('Таблица photos готова');
        }
    });
}

module.exports = db;