
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Mock the database to use an in-memory database for tests
jest.mock('sqlite3', () => {
  const originalSqlite3 = jest.requireActual('sqlite3');
  return {
    ...originalSqlite3,
    Database: jest.fn((...args) => {
      const db = new originalSqlite3.Database(':memory:', ...args.slice(1));
      return db;
    }),
  };
});

const db = require('../database');

describe('Database Initialization', () => {
  it('should connect to the database', (done) => {
    expect(db).toBeDefined();
    done();
  });

  it('should create the photos table', (done) => {
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='photos'", (err, row) => {
      expect(err).toBeNull();
      expect(row).toBeDefined();
      expect(row.name).toBe('photos');
      done();
    });
  });

  it('should have the correct columns in the photos table', (done) => {
    db.all("PRAGMA table_info(photos)", (err, columns) => {
      expect(err).toBeNull();
      const columnNames = columns.map(col => col.name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('filename');
      expect(columnNames).toContain('original_name');
      expect(columnNames).toContain('file_path');
      expect(columnNames).toContain('file_size');
      expect(columnNames).toContain('mime_type');
      expect(columnNames).toContain('upload_date');
      expect(columnNames).toContain('description');
      expect(columnNames).toContain('tags');
      expect(columnNames).toContain('is_public');
      expect(columnNames).toContain('source');
      expect(columnNames).toContain('hash');
      expect(columnNames).toContain('marketplace_sku');
      done();
    });
  });
});
