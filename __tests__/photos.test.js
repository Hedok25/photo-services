
const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs');
const photoRoutes = require('../routes/photos');
const db = require('../database');

// Mock the database
jest.mock('../database', () => {
  const originalDb = jest.requireActual('../database');
  return {
    ...originalDb,
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn(),
  };
});

// Mock fs
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  mkdirSync: jest.fn(),
  unlink: jest.fn(),
  unlinkSync: jest.fn(),
}));

const app = express();
app.use(express.json());
app.use('/api/photos', photoRoutes);

describe('Photos API', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/photos', () => {
    it('should return all photos', async () => {
      const mockPhotos = [{ id: 1, filename: 'test.jpg' }];
      db.all.mockImplementation((query, callback) => {
        callback(null, mockPhotos);
      });

      const res = await request(app).get('/api/photos');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockPhotos);
    });

    it('should handle errors', async () => {
      db.all.mockImplementation((query, callback) => {
        callback(new Error('DB error'), null);
      });

      const res = await request(app).get('/api/photos');
      expect(res.statusCode).toEqual(500);
      expect(res.body).toHaveProperty('error', 'Ошибка получения данных');
    });
  });

  describe('GET /api/photos/:id', () => {
    it('should return a photo by id', async () => {
      const mockPhoto = { id: 1, filename: 'test.jpg' };
      db.get.mockImplementation((query, params, callback) => {
        callback(null, mockPhoto);
      });

      const res = await request(app).get('/api/photos/1');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockPhoto);
    });

    it('should return 404 if photo not found', async () => {
      db.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      const res = await request(app).get('/api/photos/1');
      expect(res.statusCode).toEqual(404);
      expect(res.body).toHaveProperty('error', 'Фото не найдено');
    });

    it('should handle errors', async () => {
        db.get.mockImplementation((query, params, callback) => {
            callback(new Error('DB error'), null);
        });

        const res = await request(app).get('/api/photos/1');
        expect(res.statusCode).toEqual(500);
        expect(res.body).toHaveProperty('error', 'Ошибка получения данных');
    });
  });

  describe('DELETE /api/photos/:id', () => {
    it('should delete a photo', async () => {
        const mockPhoto = { id: 1, file_path: '/uploads/test.jpg' };
        db.get.mockImplementation((query, params, callback) => {
            callback(null, mockPhoto);
        });
        db.run.mockImplementation((query, params, callback) => {
            callback(null);
        });
        fs.unlink.mockImplementation((path, callback) => {
            callback(null);
        });

        const res = await request(app).delete('/api/photos/1');
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('message', 'Фото успешно удалено');
    });

    it('should return 404 if photo not found', async () => {
        db.get.mockImplementation((query, params, callback) => {
            callback(null, null);
        });

        const res = await request(app).delete('/api/photos/1');
        expect(res.statusCode).toEqual(404);
        expect(res.body).toHaveProperty('error', 'Фото не найдено');
    });
  });

  describe('GET /api/photos/search/tags', () => {
    it('should search photos by tag', async () => {
        const mockPhotos = [{ id: 1, filename: 'test.jpg', tags: 'test' }];
        db.all.mockImplementation((query, params, callback) => {
            callback(null, mockPhotos);
        });

        const res = await request(app).get('/api/photos/search/tags?q=test');
        expect(res.statusCode).toEqual(200);
        expect(res.body).toEqual(mockPhotos);
    });

    it('should return 400 if no tag is provided', async () => {
        const res = await request(app).get('/api/photos/search/tags');
        expect(res.statusCode).toEqual(400);
        expect(res.body).toHaveProperty('error', 'Не указан тег для поиска');
    });
  });
});
