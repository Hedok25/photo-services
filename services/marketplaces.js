const crypto = require('crypto');
const fs = require('fs');
const { pipeline } = require('stream/promises');
const path = require('path');
const db = require('../database');
const config = require('../config.json');

const UPLOADS_DIR = path.join(__dirname, '../uploads/images');
const MAX_FILES_PER_DIR = 5000;

/**
 * Находит или создает новую папку для загрузки, если текущая заполнена.
 * @returns {Promise<{dirPath: string, dirName: string}>}
 */
async function getUploadDir() {
    await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });
    const dirs = await fs.promises.readdir(UPLOADS_DIR, { withFileTypes: true });
    const subDirs = dirs.filter(d => d.isDirectory()).map(d => d.name).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

    let targetDirName = subDirs[0];
    if (targetDirName) {
        const dirPath = path.join(UPLOADS_DIR, targetDirName);
        const files = await fs.promises.readdir(dirPath);
        if (files.length >= MAX_FILES_PER_DIR) {
            targetDirName = (parseInt(targetDirName, 10) + 1).toString().padStart(3, '0');
        }
    } else {
        targetDirName = '001';
    }

    const newDirPath = path.join(UPLOADS_DIR, targetDirName);
    await fs.promises.mkdir(newDirPath, { recursive: true });
    return { dirPath: newDirPath, dirName: targetDirName };
}


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
 * @returns {Promise<{imagePath: string, dirName: string}|null>} - Путь к сохраненному файлу или null в случае ошибки.
 */
async function downloadImage(url, filename) {
    try {
        const { dirPath, dirName } = await getUploadDir();
        const imagePath = path.join(dirPath, filename);

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
        }

        await pipeline(response.body, fs.createWriteStream(imagePath));

        return { imagePath, dirName };
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
    console.log('Получение данных из Ozon API...');
    let productListData = [];
    const limit = 1000;
    let last_id = '';
    try {
        while (true) {
            const productListResponse = await fetch('https://api-seller.ozon.ru/v4/product/info/attributes', {
                method: 'POST',
                headers: {
                    'Client-Id': config.ozon_client_id,
                    'Api-Key': config.ozon_api_key,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    filter: { visibility: "ALL" },
                    limit,
                    last_id
                })
            });
            if (!productListResponse.ok) {
                throw new Error(`Ozon API error: ${productListResponse.statusText}`);
            }

            const productData = await productListResponse.json();
            if (!productData.result) {
                console.warn('Ozon API returned no result field.');
                break;
            }
            console.log('Получено товаров:', productData.result.length);
            productListData.push(...productData.result);
            if (productData.result.length < limit) break;
            last_id = productData.last_id;
        }
        return productListData.map(item => ({
            sku: item.offer_id,
            photos: [item.primary_image].map(url => ({ url }))
        }));

    } catch (error) {
        console.error('Ошибка получения данных из Ozon API:', error);
        return [];
    }
}

/**
 * Конструирует URL изображения Wildberries.
 * @param {number} nmId - Артикул WB.
 * @param {string} photoName - Имя файла фотографии.
 * @returns {string} - Полный URL изображения.
 */
/*
function constructWbPhotoUrl(nmId, photoName) {
    const vol = Math.floor(nmId / 100000);
    const part = Math.floor(nmId / 1000);
    // Шардинг корзин WB
    let host;
    if (vol >= 0 && vol <= 143) host = 'basket-01.wbbasket.ru';
    else if (vol >= 144 && vol <= 287) host = 'basket-02.wbbasket.ru';
    else if (vol >= 288 && vol <= 431) host = 'basket-03.wbbasket.ru';
    else if (vol >= 432 && vol <= 719) host = 'basket-04.wbbasket.ru';
    else if (vol >= 720 && vol <= 1007) host = 'basket-05.wbbasket.ru';
    else if (vol >= 1008 && vol <= 1061) host = 'basket-06.wbbasket.ru';
    else if (vol >= 1062 && vol <= 1115) host = 'basket-07.wbbasket.ru';
    else if (vol >= 1116 && vol <= 1169) host = 'basket-08.wbbasket.ru';
    else if (vol >= 1170 && vol <= 1313) host = 'basket-09.wbbasket.ru';
    else if (vol >= 1314 && vol <= 1601) host = 'basket-10.wbbasket.ru';
    else if (vol >= 1602 && vol <= 1655) host = 'basket-11.wbbasket.ru';
    else if (vol >= 1656 && vol <= 1919) host = 'basket-12.wbbasket.ru';
    else host = 'basket-13.wbbasket.ru';

    return `https://${host}/vol${vol}/part${part}/${nmId}/images/big/${photoName}.jpg`;
}*/


/**
 * Получает список товаров и их изображений из Wildberries API.
 * @returns {Promise<Array<{sku: string, photos: Array<{url: string, original_name: string}>}>>}
 */
async function getWbPhotos() {
    console.log('Получение данных из WB API...');
    let allCards = [];
    try {
        let cursor = {};
        while (true) {
            cursor.limit = 100;
            const response = await fetch('https://content-api.wildberries.ru/content/v2/get/cards/list', {
                method: 'POST',
                headers: {
                    'Authorization': `${config.wb_api_key}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    settings: {
                        cursor: cursor,
                        filter: {
                            "withPhoto": -1
                        }
                    }
                })
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`WB API error: ${response.statusText}. Body: ${errorBody}`);
            }

            const data = await response.json();
            if (data.error) {
                throw new Error(`WB API error: ${data.error.message}`);
            }

            if (!data.cards || data.cards.length === 0) {
                console.log(`Нет записей для обработки.`)
                break;
            }
            console.log('Получено товаров:', data.cards.length);
            allCards.push(...data.cards);
            cursor = data.cursor;
            total = data.cursor.total;
        }

        return allCards.map(card => ({
            sku: card.vendorCode,
            photos: [{ url: card.photos?card.photos[0].big:null}]
        })
        );

    } catch (error) {
        console.error('Ошибка получения данных из WB API:', error);
        return [];
    }
}

/**
 * Обрабатывает фотографии для одного товара с маркетплейса.
 * @param {object} product - Товар с маркетплейса.
 * @param {'ozon' | 'wb' | 'instagram'} source - Источник ('ozon', 'wb' или 'instagram').
 */
async function processProductPhotos(product, source) {
    const { sku, photos } = product;
    for (const photo of photos) {
        const imageUrl = photo.url;
        if (!imageUrl) continue;

        const originalFileName = path.basename(new URL(imageUrl).pathname);
        const fileExtension = path.extname(originalFileName) || '.jpg';
        const newFileName = `${source}_${sku}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${fileExtension}`;

        const downloadResult = await downloadImage(imageUrl, newFileName);
        if (!downloadResult) continue;

        const { imagePath: tempPath, dirName } = downloadResult;

        const newHash = await calculateHash(tempPath);

        const existingPhoto = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM photos WHERE marketplace_sku = ? AND source = ? AND hash = ?', [sku, source, newHash], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });

        if (existingPhoto) {
            console.log(`Фото для ${sku} (${newHash.substring(0, 7)}) уже существует и не изменилось.`);
            await fs.promises.unlink(tempPath);
        } else {
            // Новое или измененное фото, сохраняем как новую запись
            const stats = await fs.promises.stat(tempPath);
            const filePath = `/uploads/images/${dirName}/${newFileName}`;

            const query = `INSERT INTO photos (filename, original_name, file_path, file_size, mime_type, description, tags, source, hash, marketplace_sku)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            const params = [newFileName, originalFileName, filePath, stats.size, `image/${fileExtension.slice(1)}`, `Фото для ${sku}`, `${source},${sku}`, source, newHash, sku];

            db.run(query, params, async function (err) {
                if (err) {
                    console.error('Ошибка сохранения нового фото в БД:', err);
                    await fs.promises.unlink(tempPath);
                } else {
                    console.log(`Сохранено новое или измененное фото для ${sku}: ${newFileName}`);
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

    const processMarketplace = async (marketplaceName, getPhotosFn, source) => {
        try {
            const products = await getPhotosFn();
            console.log(`Синхронизация ${marketplaceName}: получено ${products.length} товаров.`);
            // Последовательная обработка продуктов для избежания проблем с БД и ФС
            for (const product of products) {
                await processProductPhotos(product, source);
            }
            console.log(`Синхронизация ${marketplaceName} завершена.`);
        } catch (error) {
            console.error(`Ошибка при синхронизации ${marketplaceName}:`, error);
        }
    };

    try {
        await Promise.all([
            processMarketplace('Ozon', getOzonPhotos, 'ozon'),
            processMarketplace('Wildberries', getWbPhotos, 'wb')
        ]);
    } finally {
        console.log('Вся синхронизация завершена.');
    }
}


module.exports = { syncPhotos };
