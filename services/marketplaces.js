const crypto = require('crypto');
const fs = require('fs');
const { pipeline } = require('stream/promises');
const path = require('path');
const db = require('../database');
const config = require('../config.json');

const UPLOADS_DIR = path.join(__dirname, '../uploads/images');

/**
 * Вычисляет SHA256 хеш файла.
 * @param {string} filePath - Путь к файлу.
 * @returns {Promise<string>} - Хеш файла в hex-формате.
 */
async function calculateHash(filePath) {
    const fileBuffer = await fs.promises.readFile(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

/**
 * Скачивает изображение по URL и сохраняет его.
 * @param {string} url - URL изображения.
 * @param {string} filename - Имя файла для сохранения.
 * @returns {Promise<string|null>} - Путь к сохраненному файлу или null в случае ошибки.
 */
async function downloadImage(url, filename) {
    try {
        await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });
        const imagePath = path.join(UPLOADS_DIR, filename);
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
        }

        // Node.js v18+
        await pipeline(response.body, fs.createWriteStream(imagePath));

        return imagePath;
    } catch (error) {
        console.error(`Ошибка скачивания изображения ${url}:`, error.message);
        return null;
    }
}

/**
 * Получает список товаров и их изображений из Ozon API.
 * @returns {Promise<Array<{sku: string, photos: Array<{url: string}>}>>}
 */
async function getOzonPhotos() {
    // ЗАГЛУШКА: Замените на реальную логику Ozon API с использованием fetch
    console.log('Получение данных из Ozon API...');
    // const response = await fetch('https://api-seller.ozon.ru/v2/product/list', {
    //     method: 'POST',
    //     headers: {
    //         'Client-Id': config.ozon_client_id,
    //         'Api-Key': config.ozon_api_key,
    //         'Content-Type': 'application/json'
    //     },
    //     body: JSON.stringify({ /* тело запроса */ })
    // });
    // const data = await response.json();
    // // Преобразуйте ответ API в нужную структуру
    return [];
}

/**
 * Получает список товаров и их изображений из Wildberries API.
 * @returns {Promise<Array<{sku: string, photos: Array<{url: string}>}>>}
 */
async function getWbPhotos() {
    // ЗАГЛУШКА: Замените на реальную логику WB API с использованием fetch
    console.log('Получение данных из WB API...');
    // const response = await fetch('https://suppliers-api.wildberries.ru/...', {
    //     headers: {
    //         'Authorization': `Bearer ${config.wb_api_key}`
    //     }
    // });
    // const data = await response.json();
    // // Преобразуйте ответ API в нужную структуру
    return [];
}

/**
 * Обрабатывает фотографии для одного товара с маркетплейса.
 * @param {object} product - Товар с маркетплейса.
 * @param {'ozon' | 'wb'} source - Источник ('ozon' или 'wb').
 */
async function processProductPhotos(product, source) {
    const { sku, photos } = product;

    for (const photo of photos) {
        const imageUrl = photo.url;
        if (!imageUrl) continue;

        const originalFileName = path.basename(new URL(imageUrl).pathname);
        const fileExtension = path.extname(originalFileName) || '.jpg';
        // Генерируем более уникальное имя, чтобы избежать коллизий
        const newFileName = `${source}_${sku}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${fileExtension}`;

        const tempPath = await downloadImage(imageUrl, newFileName);
        if (!tempPath) continue;

        const newHash = await calculateHash(tempPath);
        
        const existingPhoto = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM photos WHERE marketplace_sku = ? AND source = ?', [sku, source], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (existingPhoto && existingPhoto.hash === newHash) {
            // Фото не изменилось, удаляем скачанный файл
            console.log(`Фото для ${sku} (${newHash.substring(0, 7)}) не изменилось.`);
            await fs.promises.unlink(tempPath);
        } else {
            // Новое или измененное фото
            const stats = await fs.promises.stat(tempPath);
            const filePath = `/uploads/images/${newFileName}`;

            const query = existingPhoto
                ? `UPDATE photos SET filename = ?, original_name = ?, file_path = ?, file_size = ?, mime_type = ?, hash = ?, upload_date = CURRENT_TIMESTAMP WHERE id = ?`
                : `INSERT INTO photos (filename, original_name, file_path, file_size, mime_type, description, tags, source, hash, marketplace_sku)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            
            const params = existingPhoto
                ? [newFileName, originalFileName, filePath, stats.size, `image/${fileExtension.slice(1)}`, newHash, existingPhoto.id]
                : [newFileName, originalFileName, filePath, stats.size, `image/${fileExtension.slice(1)}`, `Фото для ${sku}`, `${source},${sku}`, source, newHash, sku];

            db.run(query, params, async function(err) {
                if (err) {
                    console.error('Ошибка сохранения фото в БД:', err);
                    await fs.promises.unlink(tempPath); // Удаляем временный файл при ошибке
                } else {
                    console.log(`Сохранено ${existingPhoto ? 'обновленное' : 'новое'} фото для ${sku}: ${newFileName}`);
                    // Если было обновление и имя файла изменилось, удаляем старый файл
                    if (existingPhoto && existingPhoto.filename !== newFileName) {
                        const oldPath = path.join(UPLOADS_DIR, existingPhoto.filename);
                        try {
                            await fs.promises.unlink(oldPath);
                            console.log(`Старый файл ${existingPhoto.filename} удален.`);
                        } catch (unlinkErr) {
                            // Игнорируем ошибку, если файла уже нет
                            if (unlinkErr.code !== 'ENOENT') {
                                console.error(`Ошибка удаления старого файла ${oldPath}:`, unlinkErr);
                            }
                        }
                    }
                }
            });
        }
    }
}


/**
 * Основная функция синхронизации.
 */
async function syncPhotos() {
    console.log('Запуск синхронизации фотографий с маркетплейсов...');
    try {
        const [ozonProducts, wbProducts] = await Promise.all([
            getOzonPhotos(),
            getWbPhotos()
        ]);

        const allProducts = [
            ...ozonProducts.map(p => ({ ...p, source: 'ozon' })),
            ...wbProducts.map(p => ({ ...p, source: 'wb' }))
        ];

        for (const product of allProducts) {
            await processProductPhotos(product, product.source);
        }

    } catch (error) {
        console.error('Ошибка во время синхронизации:', error);
    } finally {
        console.log('Синхронизация завершена.');
    }
}

module.exports = { syncPhotos };
