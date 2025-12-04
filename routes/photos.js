const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

const router = express.Router();

// Создаем папку для загрузок если её нет
const uploadDir = path.join(__dirname, '../uploads/images');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = uuidv4() + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB лимит
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Разрешены только изображения'));
        }
    }
});

// Загрузка фото
router.post('/upload', upload.single('photo'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Файл не загружен' });
        }

        const { description, tags } = req.body;
        const fileInfo = {
            filename: req.file.filename,
            original_name: req.file.originalname,
            file_path: `/uploads/images/${req.file.filename}`,
            file_size: req.file.size,
            mime_type: req.file.mimetype,
            description: description || '',
            tags: tags || ''
        };

        // Сохраняем в БД
        db.run(`
            INSERT INTO photos (filename, original_name, file_path, file_size, mime_type, description, tags)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            fileInfo.filename,
            fileInfo.original_name,
            fileInfo.file_path,
            fileInfo.file_size,
            fileInfo.mime_type,
            fileInfo.description,
            fileInfo.tags
        ], function(err) {
            if (err) {
                console.error('Ошибка сохранения в БД:', err);
                // Удаляем загруженный файл при ошибке
                fs.unlinkSync(req.file.path);
                return res.status(500).json({ error: 'Ошибка сохранения файла' });
            }

            res.json({
                message: 'Фото успешно загружено',
                photo: {
                    id: this.lastID,
                    ...fileInfo,
                    url: `${req.protocol}://${req.get('host')}${fileInfo.file_path}`
                }
            });
        });

    } catch (error) {
        console.error('Ошибка загрузки:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить все фото
router.get('/', (req, res) => {
    db.all(`
        SELECT *, 
        '${req.protocol}://${req.get('host')}' || file_path as full_url 
        FROM photos 
        ORDER BY upload_date DESC
    `, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Ошибка получения данных' });
        }
        res.json(rows);
    });
});

// Получить фото по ID
router.get('/:id', (req, res) => {
    const photoId = req.params.id;

    db.get(`
        SELECT *, 
        '${req.protocol}://${req.get('host')}' || file_path as full_url 
        FROM photos WHERE id = ?
    `, [photoId], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Ошибка получения данных' });
        }
        if (!row) {
            return res.status(404).json({ error: 'Фото не найдено' });
        }
        res.json(row);
    });
});

// Удалить фото
router.delete('/:id', (req, res) => {
    const photoId = req.params.id;

    // Сначала получаем информацию о файле
    db.get('SELECT * FROM photos WHERE id = ?', [photoId], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Ошибка получения данных' });
        }
        if (!row) {
            return res.status(404).json({ error: 'Фото не найдено' });
        }

        // Удаляем файл с диска
        const filePath = path.join(__dirname, '..', row.file_path);
        fs.unlink(filePath, (err) => {
            if (err && err.code !== 'ENOENT') {
                console.error('Ошибка удаления файла:', err);
            }

            // Удаляем запись из БД
            db.run('DELETE FROM photos WHERE id = ?', [photoId], function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Ошибка удаления записи' });
                }
                res.json({ message: 'Фото успешно удалено' });
            });
        });
    });
});

// Поиск фото по тегам
router.get('/search/tags', (req, res) => {
    const searchTag = req.query.q;
    if (!searchTag) {
        return res.status(400).json({ error: 'Не указан тег для поиска' });
    }

    db.all(`
        SELECT *, 
        '${req.protocol}://${req.get('host')}' || file_path as full_url 
        FROM photos 
        WHERE tags LIKE ? 
        ORDER BY upload_date DESC
    `, [`%${searchTag}%`], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Ошибка поиска' });
        }
        res.json(rows);
    });
});
