const express = require('express');
const path = require('path');
const db = require('./database');
const photoRoutes = require('./routes/photos');

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
                .upload-form { margin: 20px 0; padding: 20px; border: 1px solid #ddd; }
                input, textarea { display: block; margin: 10px 0; padding: 8px; width: 100%; }
                button { padding: 10px 20px; background: #007bff; color: white; border: none; cursor: pointer; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Фото Сервис</h1>
                
                <div class="upload-form">
                    <h3>Загрузить новое фото</h3>
                    <form action="/api/photos/upload" method="POST" enctype="multipart/form-data">
                        <input type="file" name="photo" accept="image/*" required>
                        <input type="text" name="description" placeholder="Описание">
                        <input type="text" name="tags" placeholder="Теги (через запятую)">
                        <button type="submit">Загрузить</button>
                    </form>
                </div>

                <div>
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
});