const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Mock do DB
const mockDb = {
    users: {
        getByUsername: jest.fn()
    },
    sessionTokens: {
        create: jest.fn(),
        getValid: jest.fn(),
        revoke: jest.fn()
    },
    auditLogs: {
        log: jest.fn().mockResolvedValue(true)
    },
    sql: {
        run: jest.fn()
    }
};

const SECRET = 'test-secret';
const mockAuth = {
    SECRET,
    verifyToken: (req, res, next) => {
        const token = req.cookies.token;
        if (!token) return res.status(401).json({ ok: false });
        try {
            req.user = jwt.verify(token, SECRET);
            next();
        } catch (e) {
            res.status(401).json({ ok: false });
        }
    },
    checkRole: () => (req, res, next) => next(),
    ROLES: { ADMIN: 'admin' },
    PUBLIC_PAGE_ACCESS: {},
    PROTECTED_PAGE_ACCESS: {}
};

describe('Auth Integration', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use(require('cookie-parser')());
        const authRouter = require('../../routes/auth')(mockDb, mockAuth);
        app.use('/api', authRouter);
    });

    test('POST /api/login - should fail with invalid credentials', async () => {
        mockDb.users.getByUsername.mockResolvedValue(null);

        const res = await request(app)
            .post('/api/login')
            .send({ username: 'wrong', password: 'password' });

        expect(res.status).toBe(401);
        expect(res.body.ok).toBe(false);
    });

    test('POST /api/refresh-token - should fail without cookies', async () => {
        const res = await request(app).post('/api/refresh-token');
        expect(res.status).toBe(401);
    });
});
