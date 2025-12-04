const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, './data/photos.db');

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
            // Добавляем новые столбцы, если они не существуют
            addColumnIfNotExists('source', 'TEXT');
            addColumnIfNotExists('hash', 'TEXT');
            addColumnIfNotExists('marketplace_sku', 'TEXT');
        }
    });
}

// Функция для добавления столбца, если он не существует
function addColumnIfNotExists(columnName, columnType) {
    db.all(`PRAGMA table_info(photos)`, (err, columns) => {
        if (err) {
            console.error('Ошибка получения информации о таблице:', err);
            return;
        }

        const columnExists = columns.some(col => col.name === columnName);
        if (!columnExists) {
            db.run(`ALTER TABLE photos ADD COLUMN ${columnName} ${columnType}`, (err) => {
                if (err) {
                    console.error(`Ошибка добавления столбца ${columnName}:`, err);
                } else {
                    console.log(`Столбец ${columnName} успешно добавлен`);
                }
            });
        }
    });
}

module.exports = db;