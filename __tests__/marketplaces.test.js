
const { syncPhotos } = require('../services/marketplaces');
const db = require('../database');
const fs = require('fs').promises;
const path = require('path');

// Mock the database
jest.mock('../database', () => ({
  run: jest.fn(),
  get: jest.fn(),
}));

// Mock fs
jest.mock('fs', () => ({
    promises: {
      mkdir: jest.fn(),
      readdir: jest.fn(),
      readFile: jest.fn(),
      stat: jest.fn(),
      unlink: jest.fn(),
    },
    createWriteStream: jest.fn(() => ({
        on: jest.fn((event, handler) => {
            if (event === 'finish') {
                handler();
            }
        }),
        end: jest.fn(),
    })),
}));

// Mock fetch
global.fetch = jest.fn();

describe('Marketplaces Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
  });

  it('should sync photos from Ozon and WB', async () => {
    // Mock Ozon API
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: {
          items: [{ product_id: 1 }],
        },
      }),
    });
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: {
          items: [
            {
              offer_id: 'ozon-sku-1',
              images: [{ default_url: 'http://example.com/ozon.jpg' }],
            },
          ],
        },
      }),
    });

    // Mock WB API
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        cards: [
          {
            nmID: 12345,
            vendorCode: 'wb-sku-1',
            mediaFiles: ['http://example.com/wb.jpg'],
          },
        ],
        cursor: { total: 1 },
      }),
    });

    // Mock DB
    db.get.mockImplementation((query, params, callback) => {
      callback(null, null); // No existing photo
    });
    db.run.mockImplementation((query, params, callback) => {
      callback(null);
    });

    // Mock fs
    await fs.readdir.mockResolvedValue([]);
    await fs.readFile.mockResolvedValue('fake-image-data');
    await fs.stat.mockResolvedValue({ size: 123 });

    await syncPhotos();

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(db.get).toHaveBeenCalledTimes(2);
    expect(db.run).toHaveBeenCalledTimes(2);
  });
});
