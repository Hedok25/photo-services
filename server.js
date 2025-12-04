const express = require('express');
const path = require('path');
const cron = require('node-cron');
const db = require('./database');
const photoRoutes = require('./routes/photos');
const { syncPhotos } = require('./services/marketplaces');
const config = require('./config.json');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Статические файлы
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// Маршруты
app.use('/api/photos', photoRoutes);

// Маршрут для ручной синхронизации
app.get('/api/sync', (req, res) => {
    console.log('Ручной запуск синхронизации...');
    syncPhotos();
    res.json({ message: 'Синхронизация запущена в фоновом режиме.' });
});

// Главная страница
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Фото Сервис</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; }
                .container { max-width: 800px; margin: 0 auto; }
                .section { margin: 20px 0; padding: 20px; border: 1px solid #ddd; }
                input, textarea { display: block; margin: 10px 0; padding: 8px; width: 100%; }
                button { padding: 10px 20px; background: #007bff; color: white; border: none; cursor: pointer; }
                a { color: #007bff; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Фото Сервис</h1>
                
                <div class="section">
                    <h3>Синхронизация с маркетплейсами</h3>
                    <a href="/api/sync" target="_blank">Запустить синхронизацию вручную</a>
                    <p>Автоматическая синхронизация выполняется по расписанию.</p>
                </div>

                <div class="section">
                    <h3>Загрузить новое фото</h3>
                    <form action="/api/photos/upload" method="POST" enctype="multipart/form-data">
                        <input type="file" name="photo" accept="image/*" required>
                        <input type="text" name="description" placeholder="Описание">
                        <input type="text" name="tags" placeholder="Теги (через запятую)">
                        <button type="submit">Загрузить</button>
                    </form>
                </div>

                <div class="section">
                    <h3>Просмотр фотографий</h3>
                    <a href="/api/photos">Список всех фотографий</a>
                </div>
            </div>
        </body>
        </html>
    `);
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
    
    // Запускаем синхронизацию при старте сервера
    console.log('Первоначальный запуск синхронизации...');
    syncPhotos();

    // Планируем регулярную синхронизацию
    if (cron.validate(config.sync_schedule)) {
        cron.schedule(config.sync_schedule, () => {
            console.log('Запуск плановой синхронизации...');
            syncPhotos();
        });
        console.log(`Синхронизация запланирована: ${config.sync_schedule}`);
    } else {
        console.error('Ошибка: Неверный формат расписания в config.json');
    }
});