
const request = require('supertest');
const express = require('express');
const path = require('path');
const photoRoutes = require('../routes/photos');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Статические файлы
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/public', express.static(path.join(__dirname, '../public')));

// Маршруты
app.use('/api/photos', photoRoutes);

// Маршрут для ручной синхронизации
app.get('/api/sync', (req, res) => {
    res.json({ message: 'Синхронизация запущена в фоновом режиме.' });
});

// Главная страница
app.get('/', (req, res) => {
    res.send('<html></html>');
});


describe('Server Endpoints', () => {
  it('should get the main page', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toEqual(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });

  it('should trigger sync', async () => {
    const res = await request(app).get('/api/sync');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('message', 'Синхронизация запущена в фоновом режиме.');
  });
});
