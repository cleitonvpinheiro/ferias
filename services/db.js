// db.js
'use strict';

require('dotenv').config();
const mysql = require('mysql2/promise');

// db.js
function sanitizeObjectForDb(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }
    const sanitized = {};

    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const value = obj[key];
            if (value === undefined) {
                sanitized[key] = null;
            } else {
                sanitized[key] = value;
            }
        }
    }
    return sanitized;
}

// ─── Pool de conexões ─────────────────────────────────────────────────────────
const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || process.env.MYSQL_USERNAME,
    password: process.env.MYSQL_PASS || process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DB || process.env.MYSQL_NAME || process.env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: '+00:00',
    charset: 'utf8mb4',
    decimalNumbers: true,
});

pool.on('connection', () => console.log('MySQL: nova conexão no pool'));

// ─── Helpers base ─────────────────────────────────────────────────────────────

/** Executa INSERT / UPDATE / DELETE. Retorna { affectedRows, insertId, changedRows } */
// db.js
const run = async (sql, params = []) => {
    const [result] = await pool.execute(sql, params);
    return result;
};

/** Retorna a primeira linha ou null. */
const get = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows[0] ?? null;
};

/** Retorna todas as linhas. */
const all = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
};

const ping = async () => {
    await get('SELECT 1 AS ok');
    return true;
};

const ensureGestorSetoresSchema = async () => {
    await run(`
        CREATE TABLE IF NOT EXISTS gestor_setores (
            gestor_username VARCHAR(100) NOT NULL,
            setor           VARCHAR(100) NOT NULL,
            created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_gestor_setor (gestor_username, setor)
        )
    `);

    const indexes = await all(`
        SELECT
            INDEX_NAME AS index_name,
            NON_UNIQUE AS non_unique,
            GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ',') AS columns_csv
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = 'gestor_setores'
        GROUP BY INDEX_NAME, NON_UNIQUE
    `);

    const norm = (v) => String(v || '').trim().toLowerCase();
    const singleSetorUnique = (indexes || []).filter(idx =>
        Number(idx && idx.non_unique) === 0 &&
        norm(idx && idx.index_name) !== 'primary' &&
        norm(idx && idx.columns_csv) === 'setor'
    );

    for (const idx of singleSetorUnique) {
        const safeIndexName = String(idx.index_name || '').replace(/`/g, '');
        if (!safeIndexName) continue;
        await run(`ALTER TABLE gestor_setores DROP INDEX \`${safeIndexName}\``);
    }

    const hasCompositeUnique = (indexes || []).some(idx =>
        Number(idx && idx.non_unique) === 0 &&
        norm(idx && idx.columns_csv) === 'gestor_username,setor'
    );

    if (!hasCompositeUnique) {
        await run('ALTER TABLE gestor_setores ADD UNIQUE INDEX uq_gestor_setor (gestor_username, setor)');
    }

    const hasGestorIndex = (indexes || []).some(idx =>
        norm(idx && idx.columns_csv) === 'gestor_username'
    );
    if (!hasGestorIndex) {
        await run('CREATE INDEX idx_gestor_setores_gestor ON gestor_setores(gestor_username)');
    }
};

const { encrypt, decrypt } = require('../utils/crypto');

/** Converte Date ou string ISO para formato MySQL datetime: 'YYYY-MM-DD HH:MM:SS' */
const toMySQLDatetime = (val) => {
    if (!val) return null;
    const d = val instanceof Date ? val : new Date(val);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 19).replace('T', ' ');
};

// ── auditLogs ────────────────────────────────────────────────────────────────
const auditLogsRepo = {
    ensureTable: async () => {
        try {
            await run(`
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id VARCHAR(255),
                    username VARCHAR(255),
                    action VARCHAR(100) NOT NULL,
                    resource VARCHAR(100),
                    resource_id VARCHAR(255),
                    details LONGTEXT,
                    ip_address VARCHAR(45),
                    user_agent TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
        } catch (err) {
            console.error('Erro ao criar tabela audit_logs:', err);
        }
    },
    log: async (data) => {
        await auditLogsRepo.ensureTable();
        const { user_id, username, action, resource, resource_id, details, ip_address, user_agent } = data;
        await run(
            `INSERT INTO audit_logs (user_id, username, action, resource, resource_id, details, ip_address, user_agent)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [user_id || null, username || null, action, resource || null, resource_id || null, details ? JSON.stringify(details) : null, ip_address || null, user_agent || null]
        );
    }
};

// ── sessionTokens ─────────────────────────────────────────────────────────────
const sessionTokensRepo = {
    ensureTable: async () => {
        try {
            await run(`
                CREATE TABLE IF NOT EXISTS session_tokens (
                    id VARCHAR(255) PRIMARY KEY,
                    user_id VARCHAR(255) NOT NULL,
                    refresh_token TEXT NOT NULL,
                    expires_at DATETIME NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    revoked BOOLEAN DEFAULT FALSE,
                    INDEX idx_user (user_id)
                )
            `);
        } catch (err) {
            console.error('Erro ao criar tabela session_tokens:', err);
        }
    },
    create: async (id, userId, refreshToken, expiresAt) => {
        await sessionTokensRepo.ensureTable();
        await run(
            'INSERT INTO session_tokens (id, user_id, refresh_token, expires_at) VALUES (?, ?, ?, ?)',
            [id, userId, refreshToken, toMySQLDatetime(expiresAt)]
        );
    },
    revoke: async (id) => {
        await run('UPDATE session_tokens SET revoked = TRUE WHERE id = ?', [id]);
    },
    revokeAllForUser: async (userId) => {
        await run('UPDATE session_tokens SET revoked = TRUE WHERE user_id = ?', [userId]);
    },
    getValid: async (id) => {
        return await get(
            'SELECT * FROM session_tokens WHERE id = ? AND revoked = FALSE AND expires_at > NOW()',
            [id]
        );
    }
};

// ─── Utilitários internos ─────────────────────────────────────────────────────

/** Escapa metacaracteres do LIKE do MySQL (%, _, \). */
const escapeLike = (str) => str.replace(/[%_\\]/g, '\\$&');

/** Parseia campos JSON de uma linha do banco. */
const parseJsonFields = (row, fields = []) => {
    if (!row) return row;
    const newRow = { ...row };
    fields.forEach(f => {
        if (newRow[f] && typeof newRow[f] === 'string') {
            try { newRow[f] = JSON.parse(newRow[f]); }
            catch { newRow[f] = null; }
        }
    });
    return newRow;
};

/**
 * Normaliza o array de questões de um formulário,
 * garantindo campos obrigatórios e tipagem correta.
 */
const normalizeFormularioQuestoes = (questoes) => {
    if (!Array.isArray(questoes)) return [];
    return questoes.map(q => {
        const base = (q && typeof q === 'object') ? { ...q } : {};
        const question = typeof base.question === 'string' && base.question.trim()
            ? base.question
            : (typeof base.text === 'string' ? base.text : '');
        const type = typeof base.type === 'string' && base.type.trim() ? base.type : 'text';
        const required = !!base.required;
        const category = typeof base.category === 'string' ? base.category : '';

        const normalized = { ...base, question, type, required, category };
        delete normalized.text;

        if (type === 'select' || type === 'multi') {
            normalized.options = Array.isArray(base.options)
                ? base.options.map(o => String(o))
                : [];
        } else {
            delete normalized.options;
        }
        return normalized;
    });
};

const countRows = async (tableName) => {
    const row = await get(`SELECT COUNT(*) AS count FROM \`${tableName}\``);
    return row ? Number(row.count) : 0;
};

const normalizeNumericIdValue = (val) => {
    const s = String(val ?? '').trim();
    if (!s) return '';
    const compact = s.replace(/\s+/g, '');
    if (/^\d+$/.test(compact)) return compact;
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(compact)) return compact.replace(/\./g, '').split(',')[0];
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(compact)) return compact.replace(/,/g, '').split('.')[0];
    if (/^\d+[.,]\d+$/.test(compact)) return compact.split(compact.includes(',') ? ',' : '.')[0];
    return s;
};

// ─── purgeTestData ────────────────────────────────────────────────────────────

/**
 * Remove todos os dados de teste das tabelas listadas.
 * BLOQUEADO em ambiente de produção (NODE_ENV=production).
 */
const purgeTestData = async ({ preserveFuncionarios = true } = {}) => {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('purgeTestData: operação proibida em ambiente de produção.');
    }

    const tablesToClear = [
        'historico_solicitacoes', 'solicitacoes_ferias', 'taxas', 'candidatos', 'vagas',
        'movimentacoes_epis', 'solicitacoes_epis', 'descontos_epis', 'movimentacoes_rh',
        'movimentacoes', 'epis', 'entrevistas_desligamento', 'recrutamento_interno',
        'onthejob', 'disciplinar_registros', 'avaliacoes', 'acessos', 'uniformes',
    ];
    if (!preserveFuncionarios) tablesToClear.push('funcionarios');

    const countsBefore = {};
    for (const t of tablesToClear) countsBefore[t] = await countRows(t);

    const conn = await pool.getConnection();
    try {
        await conn.execute('SET FOREIGN_KEY_CHECKS = 0');
        await conn.beginTransaction();
        for (const t of tablesToClear) await conn.execute(`DELETE FROM \`${t}\``);
        await conn.commit();
        await conn.execute('SET FOREIGN_KEY_CHECKS = 1');
    } catch (e) {
        await conn.rollback();
        await conn.execute('SET FOREIGN_KEY_CHECKS = 1');
        conn.release();
        throw e;
    }
    conn.release();

    const countsAfter = {};
    for (const t of tablesToClear) countsAfter[t] = await countRows(t);
    return { ok: true, preserveFuncionarios, countsBefore, countsAfter };
};

// ─── Repositories ─────────────────────────────────────────────────────────────

// ── solicitacoes ──────────────────────────────────────────────────────────────
const solicitacoesRepo = {
    getAll: async () => {
        const rows = await all('SELECT * FROM solicitacoes_ferias');
        const history = await all('SELECT * FROM historico_solicitacoes ORDER BY data');
        const historyMap = {};
        history.forEach(h => {
            if (!historyMap[h.solicitacao_id]) historyMap[h.solicitacao_id] = [];
            historyMap[h.solicitacao_id].push(h);
        });
        return rows.map(r => ({
            ...r,
            funcionarioId: r.funcionario_id,
            tipoGozo: r.tipo_gozo,
            gestorEmail: r.gestor_email,
            nomeGestor: r.nome_gestor,
            statusRH: r.status_rh,
            sugestaoData: r.sugestao_data,
            signatureToken: r.signature_token,
            signedAt: r.signed_at,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
            historico: historyMap[r.id] || [],
        }));
    },

    getById: async (id) => {
        const row = await get('SELECT * FROM solicitacoes_ferias WHERE id = ?', [id]);
        if (!row) return null;
        const history = await all(
            'SELECT * FROM historico_solicitacoes WHERE solicitacao_id = ? ORDER BY data', [id]
        );
        return {
            ...row,
            funcionarioId: row.funcionario_id,
            tipoGozo: row.tipo_gozo,
            gestorEmail: row.gestor_email,
            nomeGestor: row.nome_gestor,
            statusRH: row.status_rh,
            sugestaoData: row.sugestao_data,
            signatureToken: row.signature_token,
            signedAt: row.signed_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            historico: history,
        };
    },

    // db.js - dentro de solicitacoesRepo
    create: async (data) => {
        const sanitizedData = sanitizeObjectForDb(data);

        const funcionarioId = sanitizedData.funcionarioId || sanitizedData.funcionario_id || null;

        const result = await run(
            `INSERT IGNORE INTO solicitacoes_ferias
             (id, funcionario_id, nome, setor, inicio, inicio2, tipo_gozo, decimo, gestor_email, nome_gestor,
              status, status_rh, sugestao_data, justificativa, assinatura, signature_token, signed_at, created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
                sanitizedData.id,
                funcionarioId,
                sanitizedData.nome ?? null,
                sanitizedData.setor ?? null,
                sanitizedData.inicio ?? null,
                sanitizedData.inicio2 ?? null,
                sanitizedData.tipoGozo ?? null,
                sanitizedData.decimo ?? null,
                sanitizedData.gestorEmail ?? null,
                sanitizedData.nomeGestor ?? null,
                sanitizedData.status ?? null,
                sanitizedData.statusRH ?? null,
                sanitizedData.sugestaoData ?? null,
                sanitizedData.justificativa ?? null,
                sanitizedData.assinatura ?? null,
                sanitizedData.signatureToken ?? null,
                sanitizedData.signedAt ?? null,
                sanitizedData.createdAt ?? null,
                sanitizedData.updatedAt ?? null
            ]
        );
        if (result.affectedRows === 0) return { ...data, created: false };
        if (Array.isArray(sanitizedData.historico)) {
            for (const h of sanitizedData.historico) {
                const sanitizedH = sanitizeObjectForDb(h);
                await run(
                    `INSERT INTO historico_solicitacoes (solicitacao_id, data, acao, ator, justificativa) VALUES (?,?,?,?,?)`,
                    [
                        sanitizedData.id,
                        toMySQLDatetime(sanitizedH.data), // <-- AQUI! Use toMySQLDatetime
                        sanitizedH.acao ?? null,
                        sanitizedH.ator ?? null,
                        sanitizedH.justificativa ?? null
                    ]
                );
            }
        }
        return { ...data, created: true };
    },

    update: async (id, data) => {
        const sanitizedData = sanitizeObjectForDb(data);

        const funcionarioId = sanitizedData.funcionarioId || sanitizedData.funcionario_id || null;
        await run(
            `UPDATE solicitacoes_ferias SET
             funcionario_id=?, nome=?, setor=?, inicio=?, inicio2=?, tipo_gozo=?, decimo=?,
             gestor_email=?, nome_gestor=?, status=?, status_rh=?, sugestao_data=?,
             justificativa=?, assinatura=?, signature_token=?, signed_at=?, updated_at=?
             WHERE id=?`,
            [
                funcionarioId,
                sanitizedData.nome ?? null,
                sanitizedData.setor ?? null,
                sanitizedData.inicio ?? null,
                sanitizedData.inicio2 ?? null,
                sanitizedData.tipoGozo ?? null,
                sanitizedData.decimo ?? null,
                sanitizedData.gestorEmail ?? null,
                sanitizedData.nomeGestor ?? null,
                sanitizedData.status ?? null,
                sanitizedData.statusRH ?? null,
                sanitizedData.sugestaoData ?? null,
                sanitizedData.justificativa ?? null,
                sanitizedData.assinatura ?? null,
                sanitizedData.signatureToken ?? null,
                sanitizedData.signedAt ?? null,
                toMySQLDatetime(sanitizedData.updatedAt), // <-- AQUI! Use toMySQLDatetime
                id
            ]
        );
        if (Array.isArray(sanitizedData.historico)) {
            await run('DELETE FROM historico_solicitacoes WHERE solicitacao_id = ?', [id]);
            for (const h of sanitizedData.historico) {
                const sanitizedH = sanitizeObjectForDb(h);
                await run(
                    `INSERT INTO historico_solicitacoes (solicitacao_id, data, acao, ator, justificativa) VALUES (?,?,?,?,?)`,
                    [
                        id,
                        toMySQLDatetime(sanitizedH.data),
                        sanitizedH.acao ?? null,
                        sanitizedH.ator ?? null,
                        sanitizedH.justificativa ?? null
                    ]
                );
            }
        }
        return data;
    },
};

// ── funcionarios ──────────────────────────────────────────────────────────────
const funcionariosRepo = {
    getAll: async (filtros = {}) => {
        const busca = String(filtros.busca || '').trim();
        let rows;
        if (!busca) {
            rows = await all('SELECT * FROM funcionarios');
        } else {
            const like = `%${escapeLike(busca)}%`;
            rows = await all('SELECT * FROM funcionarios WHERE nome LIKE ?', [like]);
        }
        return rows.map(r => ({ ...r, cpf: decrypt(r.cpf) }));
    },

    getById: async (id) => {
        const row = await get('SELECT * FROM funcionarios WHERE id = ?', [id]);
        if (row) row.cpf = decrypt(row.cpf);
        return row;
    },

    create: async (data) => {
        const result = await run(
            `INSERT IGNORE INTO funcionarios
             (id, nome, cpf, matricula, cargo, setor, data_admissao, nascimento, sexo, raca_cor,
              nacionalidade, tipo_vinculo, contrato, pais_origem, estado_origem, naturalidade,
              anotacoes, foto, banco, agencia, conta, tipo_conta, chave_pix, status)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [data.id, data.nome, encrypt(data.cpf) || null, data.matricula || null, data.cargo || null,
            data.setor || null, data.data_admissao || null, data.nascimento || null,
            data.sexo || null, data.raca_cor || null, data.nacionalidade || null,
            data.tipo_vinculo || null, data.contrato || null, data.pais_origem || null,
            data.estado_origem || null, data.naturalidade || null, data.anotacoes || null,
            data.foto || null, data.banco || null, data.agencia || null, data.conta || null,
            data.tipo_conta || null, data.chave_pix || null, data.status || 'Ativo']
        );
        return { ...data, created: result.affectedRows > 0 };
    },

    update: async (id, data) => {
        await run(
            `UPDATE funcionarios SET
             nome=?, cpf=?, matricula=?, cargo=?, setor=?, data_admissao=?, nascimento=?, sexo=?,
             raca_cor=?, nacionalidade=?, tipo_vinculo=?, contrato=?, pais_origem=?, estado_origem=?,
             naturalidade=?, anotacoes=?, foto=?, banco=?, agencia=?, conta=?, tipo_conta=?,
             chave_pix=?, status=?, updated_at=NOW()
             WHERE id=?`,
            [data.nome, encrypt(data.cpf) || null, data.matricula || null, data.cargo || null,
            data.setor || null, data.data_admissao || null, data.nascimento || null,
            data.sexo || null, data.raca_cor || null, data.nacionalidade || null,
            data.tipo_vinculo || null, data.contrato || null, data.pais_origem || null,
            data.estado_origem || null, data.naturalidade || null, data.anotacoes || null,
            data.foto || null, data.banco || null, data.agencia || null, data.conta || null,
            data.tipo_conta || null, data.chave_pix || null, data.status || 'Ativo', id]
        );
        return data;
    },

    updateFoto: async (id, filename) => {
        await run('UPDATE funcionarios SET foto=?, updated_at=NOW() WHERE id=?', [filename, id]);
    },

    delete: async (id) => {
        const result = await run('DELETE FROM funcionarios WHERE id = ?', [id]);
        return result.affectedRows > 0;
    },
};

// ── users ─────────────────────────────────────────────────────────────────────
// Usado pelo auth.js em: db.users.getByUsername(username)
const usersRepo = {
    getAll: async () => {
        const rows = await all('SELECT * FROM users');
        return rows.map(r => ({ ...r, email: decrypt(r.email) }));
    },

    listPaginated: async ({ page = 1, limit = 10, search = '' } = {}) => {
        const safeLimit = Math.max(1, parseInt(limit, 10) || 10);
        const safePage = Math.max(1, parseInt(page, 10) || 1);
        const safeOffset = (safePage - 1) * safeLimit;
        const searchStr = String(search || '').trim();

        let rows, countResult;

        if (searchStr) {
            const like = `%${escapeLike(searchStr)}%`;
            rows = await all(
                `SELECT * FROM users WHERE username LIKE ? OR name LIKE ? ORDER BY created_at DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`,
                [like, like]
            );
            countResult = await get(
                'SELECT COUNT(*) as total FROM users WHERE username LIKE ? OR name LIKE ?',
                [like, like]
            );
        } else {
            rows = await all(
                `SELECT * FROM users ORDER BY created_at DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`,
                []
            );
            countResult = await get('SELECT COUNT(*) as total FROM users', []);
        }

        const total = countResult ? Number(countResult.total) : 0;

        return {
            users: rows.map(r => ({ ...r, email: decrypt(r.email) })),
            total,
            page: safePage,
            totalPages: Math.ceil(total / safeLimit)
        };
    },


    getByUsername: async (username) => {
        const row = await get('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [username]);
        if (row) {
            row.email = decrypt(row.email);
            // Alias para compatibilidade se o código esperar password_hash
            row.password_hash = row.password;
        }
        return row;
    },

    getById: async (id) => {
        const row = await get('SELECT * FROM users WHERE id = ?', [id]);
        if (row) {
            row.email = decrypt(row.email);
            row.password_hash = row.password;
        }
        return row;
    },

    create: async (data) => {
        const blockedVal = Array.isArray(data.blocked_paths) ? JSON.stringify(data.blocked_paths) : data.blocked_paths;
        const result = await run(
            `INSERT IGNORE INTO users (username, password, role, email, name, blocked_paths, created_at)
             VALUES (?,?,?,?,?,?,?)`,
            [
                data.username,
                data.password || data.password_hash,
                data.role || 'pendente',
                encrypt(data.email) || null,
                data.name || null,
                blockedVal || null,
                toMySQLDatetime(data.created_at || new Date())
            ]
        );
        return { ...data, created: result.affectedRows > 0 };
    },

    update: async (username, data) => {
        const fields = [];
        const params = [];

        if (data.role) { fields.push('role = ?'); params.push(data.role); }
        if (Object.prototype.hasOwnProperty.call(data, 'email')) { fields.push('email = ?'); params.push(encrypt(data.email) || null); }
        if (data.name) { fields.push('name = ?'); params.push(data.name); }
        if (data.password || data.password_hash) { fields.push('password = ?'); params.push(data.password || data.password_hash); }
        if (Object.prototype.hasOwnProperty.call(data, 'blocked_paths')) {
            const val = Array.isArray(data.blocked_paths) ? JSON.stringify(data.blocked_paths) : data.blocked_paths;
            fields.push('blocked_paths = ?');
            params.push(val || null);
        }

        if (fields.length === 0) return data;

        params.push(username);
        await run(`UPDATE users SET ${fields.join(', ')} WHERE username = ?`, params);
        return data;
    },

    updatePassword: async (username, password) => {
        await run('UPDATE users SET password=? WHERE username=?', [password, username]);
    },

    delete: async (username) => {
        const result = await run('DELETE FROM users WHERE username = ?', [username]);
        return result.affectedRows > 0;
    },
};

// ── rolePermissions ───────────────────────────────────────────────────────────
// Usado pelo auth.js em: db.rolePermissions.getAll()
// Espera uma tabela `role_permissions` com colunas: role, protected_paths (JSON)
const rolePermissionsRepo = {
    getAll: async () => {
        const rows = await all('SELECT * FROM role_permissions');
        return rows.map(r => parseJsonFields(r, ['protected_paths']));
    },

    getByRole: async (role) => {
        const row = await get('SELECT * FROM role_permissions WHERE role = ?', [role]);
        return parseJsonFields(row, ['protected_paths']);
    },

    upsert: async (roleOrObj, protectedPaths) => {
        let role = roleOrObj;
        let paths = protectedPaths;

        if (roleOrObj && typeof roleOrObj === 'object' && !Array.isArray(roleOrObj)) {
            role = roleOrObj.role;
            paths = roleOrObj.protectedPaths || roleOrObj.protected_paths;
        }

        const json = JSON.stringify(Array.isArray(paths) ? paths : []);
        await run(
            `INSERT INTO role_permissions (role, protected_paths)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE protected_paths = VALUES(protected_paths), updated_at = NOW()`,
            [role, json]
        );
    },

    delete: async (role) => {
        const result = await run('DELETE FROM role_permissions WHERE role = ?', [role]);
        return result.affectedRows > 0;
    },
};

// ── avaliacoes ────────────────────────────────────────────────────────────────
const avaliacoesRepo = {
    getAll: async () => await all('SELECT * FROM avaliacoes'),
    getById: async (id) => await get('SELECT * FROM avaliacoes WHERE id = ?', [id]),
    getAllPendentes: async () => await all("SELECT * FROM avaliacoes WHERE status = 'pendente'"),
    create: async (data) => {
        const dados = JSON.stringify(Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v === undefined ? null : v])));
        const r = await run(
            `INSERT INTO avaliacoes (id, tipo, funcionario, avaliador, dados, created_at) VALUES (?,?,?,?,?,?)`,
            [data.id || null, data.tipo || null, data.funcionario || data.avaliado_nome || null, data.avaliador || null, dados, toMySQLDatetime(data.created_at || data.createdAt || new Date())]
        );
        return { ...data, created: r.affectedRows > 0 };
    },
    update: async (id, data) => { await run(`UPDATE avaliacoes SET status=?, respostas=?, updated_at=NOW() WHERE id=?`, [data.status, JSON.stringify(data.respostas || null), id]); return data; },
    delete: async (id) => { const r = await run('DELETE FROM avaliacoes WHERE id=?', [id]); return r.affectedRows > 0; },
};

// ── avaliacaoCiclos ───────────────────────────────────────────────────────────
const avaliacaoCiclosRepo = {
    getAll: async () => await all('SELECT * FROM avaliacao_ciclos ORDER BY created_at DESC'),
    getById: async (id) => await get('SELECT * FROM avaliacao_ciclos WHERE id = ?', [id]),
    getAtivo: async () => await get("SELECT * FROM avaliacao_ciclos WHERE status = 'ativo' LIMIT 1"),
    create: async (data) => { const r = await run(`INSERT INTO avaliacao_ciclos (id,titulo,descricao,modelo,tipo_formulario,pesos_categoria,pesos_relacao,max_score_item,data_inicio,data_fim,status,criado_por,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, [data.id, data.titulo || data.nome, data.descricao || null, data.modelo || null, data.tipo_formulario || null, data.pesos_categoria ? JSON.stringify(data.pesos_categoria) : null, data.pesos_relacao ? JSON.stringify(data.pesos_relacao) : null, data.max_score_item || null, data.data_inicio || data.inicio, data.data_fim || data.fim, data.status || 'ativo', data.criado_por || null, toMySQLDatetime(data.created_at || new Date())]); return { ...data, created: r.affectedRows > 0 }; },
    update: async (id, data) => { await run(`UPDATE avaliacao_ciclos SET titulo=?,descricao=?,modelo=?,tipo_formulario=?,data_inicio=?,data_fim=?,status=? WHERE id=?`, [data.titulo || data.nome, data.descricao || null, data.modelo || null, data.tipo_formulario || null, data.data_inicio || data.inicio, data.data_fim || data.fim, data.status, id]); return data; },
    delete: async (id) => { const r = await run('DELETE FROM avaliacao_ciclos WHERE id=?', [id]); return r.affectedRows > 0; },
    listByAvaliador: async (username) => await all('SELECT c.* FROM avaliacao_ciclos c JOIN avaliacao_participantes p ON p.ciclo_id = c.id WHERE LOWER(p.avaliador_username) = LOWER(?)', [username]),
    updateStatus: async (data) => { await run('UPDATE avaliacao_ciclos SET status=? WHERE id=?', [data.status, data.id]); },
};

// ── avaliacaoParticipantes ────────────────────────────────────────────────────
const avaliacaoParticipantesRepo = {
    getAll: async () => await all('SELECT * FROM avaliacao_participantes'),
    getById: async (id) => await get('SELECT * FROM avaliacao_participantes WHERE id = ?', [id]),
    getByCiclo: async (cicloId) => await all('SELECT * FROM avaliacao_participantes WHERE ciclo_id = ?', [cicloId]),
    listByCiclo: async (cicloId) => await all('SELECT * FROM avaliacao_participantes WHERE ciclo_id = ?', [cicloId]),
    getByFuncionario: async (funcId) => await all('SELECT * FROM avaliacao_participantes WHERE avaliado_id = ?', [funcId]),
    getAllPendentes: async () => await all("SELECT * FROM avaliacao_participantes WHERE status IN ('pendente', 'em_andamento')"),
    create: async (data) => {
        const r = await run(
            `INSERT IGNORE INTO avaliacao_participantes (id,ciclo_id,avaliado_id,avaliado_nome,avaliado_setor,avaliado_cargo,avaliador_username,avaliador_nome,avaliador_role,relacao,peso,status,created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
                data.id || null,
                data.ciclo_id,
                data.avaliado_id || data.funcionario_id,
                data.avaliado_nome || null,
                data.avaliado_setor || null,
                data.avaliado_cargo || null,
                data.avaliador_username || null,
                data.avaliador_nome || null,
                data.avaliador_role || null,
                data.relacao || null,
                data.peso || 1,
                data.status || 'pendente',
                toMySQLDatetime(data.created_at || new Date())
            ]
        );
        return { ...data, created: r.affectedRows > 0 };
    },
    update: async (id, data) => {
        await run(`UPDATE avaliacao_participantes SET status=? WHERE id=?`, [data.status, id]);
        return data;
    },
    markStarted: async ({ id }) => {
        await run("UPDATE avaliacao_participantes SET status='em_andamento', started_at=NOW() WHERE id=?", [id]);
    },
    complete: async ({ id, avaliacaoId }) => {
        await run("UPDATE avaliacao_participantes SET status='concluido', avaliacao_id=?, completed_at=NOW() WHERE id=?", [avaliacaoId, id]);
    },
    deleteByCiclo: async (cicloId) => {
        const r = await run('DELETE FROM avaliacao_participantes WHERE ciclo_id=?', [cicloId]);
        return r.affectedRows;
    },
    listPendentesByAvaliador: async (username) => await all("SELECT * FROM avaliacao_participantes WHERE LOWER(avaliador_username) = LOWER(?) AND status IN ('pendente', 'em_andamento')", [username]),
};

// ── avaliacaoPrazos ───────────────────────────────────────────────────────────
const avaliacaoPrazosRepo = {
    getAll: async () => await all('SELECT * FROM avaliacao_prazos'),
    getByCiclo: async (cicloId) => await all('SELECT * FROM avaliacao_prazos WHERE ciclo_id = ?', [cicloId]),
    upsert: async (data) => { await run(`INSERT INTO avaliacao_prazos (ciclo_id,tipo,prazo) VALUES (?,?,?) ON DUPLICATE KEY UPDATE prazo=VALUES(prazo), updated_at=NOW()`, [data.ciclo_id, data.tipo, data.prazo]); },
    deleteByCiclo: async (cicloId) => { const r = await run('DELETE FROM avaliacao_prazos WHERE ciclo_id=?', [cicloId]); return r.affectedRows; },
    getByTipo: async (tipo) => await all('SELECT * FROM avaliacao_prazos WHERE tipo = ?', [tipo]),
    getByCicloETipo: async (cicloId, tipo) => await get('SELECT * FROM avaliacao_prazos WHERE ciclo_id = ? AND tipo = ?', [cicloId, tipo]),
};

// ── avaliacaoConsolidado ──────────────────────────────────────────────────────
const avaliacaoConsolidadoRepo = {
    getAll: async () => await all('SELECT * FROM avaliacao_consolidado'),
    getByCiclo: async (cicloId) => await all('SELECT * FROM avaliacao_consolidado WHERE ciclo_id = ?', [cicloId]),
    upsert: async (data) => { await run(`INSERT INTO avaliacao_consolidado (ciclo_id,funcionario_id,nota,observacoes) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE nota=VALUES(nota),observacoes=VALUES(observacoes),updated_at=NOW()`, [data.ciclo_id, data.funcionario_id, data.nota, data.observacoes || null]); },
};

// ── gestorEquipes ─────────────────────────────────────────────────────────────
const gestorEquipesRepo = {
    getAll: async () => await all('SELECT * FROM gestor_equipes'),
    getEquipeByGestor: async (username) => await all('SELECT f.* FROM gestor_equipes ge JOIN funcionarios f ON f.id = ge.funcionario_id WHERE LOWER(ge.gestor_username) = LOWER(?)', [username]),
    getByGestor: async (username) => await all('SELECT * FROM gestor_equipes WHERE LOWER(gestor_username) = LOWER(?)', [username]),
    addMembro: async (gestorUsername, funcionarioId) => { const r = await run(`INSERT IGNORE INTO gestor_equipes (gestor_username,funcionario_id) VALUES (?,?)`, [gestorUsername, funcionarioId]); return r.affectedRows > 0; },
    removeMembro: async (gestorUsername, funcionarioId) => { const r = await run(`DELETE FROM gestor_equipes WHERE gestor_username=? AND funcionario_id=?`, [gestorUsername, funcionarioId]); return r.affectedRows > 0; },
    deleteByGestor: async (username) => { const r = await run('DELETE FROM gestor_equipes WHERE LOWER(gestor_username)=LOWER(?)', [username]); return r.affectedRows; },
};

// ── gestorSetores ─────────────────────────────────────────────────────────────

const gestorSetoresRepo = {
    getSetoresByGestor: async (username) =>
        await all('SELECT setor FROM gestor_setores WHERE LOWER(gestor_username) = LOWER(?)', [username]),

    addSetor: async (gestorUsername, setor) => {
        const r = await run(
            `INSERT IGNORE INTO gestor_setores (gestor_username, setor) VALUES (?, ?)`,
            [gestorUsername, setor]
        );
        return r.affectedRows > 0;
    },

    removeSetor: async (gestorUsername, setor) => {
        const r = await run(
            `DELETE FROM gestor_setores WHERE gestor_username = ? AND setor = ?`,
            [gestorUsername, setor]
        );
        return r.affectedRows > 0;
    },

    deleteByGestor: async (username) => {
        const r = await run(
            'DELETE FROM gestor_setores WHERE LOWER(gestor_username) = LOWER(?)',
            [username]
        );
        return r.affectedRows;
    },
};



// ── dashboardsFormularios ─────────────────────────────────────────────────────
const dashboardsFormulariosRepo = {
    getAll: async () => await all('SELECT * FROM formularios_dashboards'),
    getById: async (id) => await get('SELECT * FROM formularios_dashboards WHERE id = ?', [id]),
    create: async (data) => {
        const r = await run(
            `INSERT INTO formularios_dashboards (id, titulo, tipo, created_at)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
                titulo = COALESCE(VALUES(titulo), titulo),
                tipo = COALESCE(VALUES(tipo), tipo),
                updated_at = NOW()`,
            [data.id, data.titulo || null, data.tipo || null, toMySQLDatetime(data.created_at || new Date())]
        );
        return { ...data, created: r.affectedRows > 0 };
    },
    touch: async (id) => {
        await run('UPDATE formularios_dashboards SET updated_at = NOW() WHERE id = ?', [id]);
    },
    delete: async (id) => {
        const r = await run('DELETE FROM formularios_dashboards WHERE id = ?', [id]);
        return r.affectedRows > 0;
    }
};

// ── formularios ───────────────────────────────────────────────────────────────
const formulariosRepo = {
    getAll: async () => {
        const rows = await all('SELECT * FROM formularios');
        return rows.map(r => {
            const row = parseJsonFields(r, ['questoes', 'allowed_roles']);
            if (row) {
                row.dashboardId = row.dashboard_id;
            }
            return row;
        });
    },
    getById: async (id) => {
        const row = await get('SELECT * FROM formularios WHERE id = ?', [id]);
        const res = parseJsonFields(row, ['questoes', 'allowed_roles']);
        if (res) {
            res.dashboardId = res.dashboard_id;
        }
        return res;
    },
    getByDashboardId: async (dashboardId) => {
        const rows = await all('SELECT * FROM formularios WHERE dashboard_id = ?', [dashboardId]);
        return rows.map(r => {
            const row = parseJsonFields(r, ['questoes', 'allowed_roles']);
            if (row) {
                row.dashboardId = row.dashboard_id;
            }
            return row;
        });
    },
    create: async (data) => {
        const r = await run(
            `INSERT INTO formularios (id, titulo, tipo, questoes, allowed_roles, publico, ativo, dashboard_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                data.id,
                data.titulo,
                data.tipo || 'geral',
                JSON.stringify(data.questoes || []),
                JSON.stringify(data.allowed_roles || []),
                data.publico ? 1 : 0,
                data.ativo !== false ? 1 : 0,
                data.dashboardId || data.dashboard_id || data.id,
                toMySQLDatetime(data.created_at || new Date())
            ]
        );
        return { ...data, created: r.affectedRows > 0 };
    },
    update: async (id, data) => {
        await run(
            `UPDATE formularios SET titulo=?, tipo=?, questoes=?, allowed_roles=?, publico=?, ativo=?, dashboard_id=?, updated_at=NOW()
             WHERE id=?`,
            [
                data.titulo,
                data.tipo || 'geral',
                JSON.stringify(data.questoes || []),
                JSON.stringify(data.allowed_roles || []),
                data.publico ? 1 : 0,
                data.ativo !== false ? 1 : 0,
                data.dashboardId || data.dashboard_id || id,
                id
            ]
        );
        return data;
    },
    delete: async (id) => {
        const r = await run('DELETE FROM formularios WHERE id=?', [id]);
        return r.affectedRows > 0;
    },
};

// ── respostasFormularios ──────────────────────────────────────────────────────
const respostasRepo = {
    getAll: async () => {
        const rows = await all('SELECT * FROM respostas_formularios');
        return rows.map(r => parseJsonFields(r, ['respostas']));
    },
    getByFormId: async (formularioId) => {
        const rows = await all('SELECT * FROM respostas_formularios WHERE formulario_id = ?', [formularioId]);
        return rows.map(r => parseJsonFields(r, ['respostas']));
    },
    getByDashboardId: async (dashboardId) => {
        const rows = await all(
            `SELECT r.*, f.titulo as formulario_titulo FROM respostas_formularios r
             JOIN formularios f ON f.id = r.formulario_id
             WHERE f.dashboard_id = ?`,
            [dashboardId]
        );
        return rows.map(r => parseJsonFields(r, ['respostas']));
    },
    create: async (data) => {
        const r = await run(
            `INSERT INTO respostas_formularios (id, formulario_id, funcionario_id, respostas, created_at)
             VALUES (?, ?, ?, ?, ?)`,
            [
                data.id,
                data.formulario_id,
                data.funcionario_id || data.respondente || null,
                JSON.stringify(data.respostas || {}),
                toMySQLDatetime(data.created_at || data.createdAt || new Date())
            ]
        );
        return { ...data, created: r.affectedRows > 0 };
    },
    delete: async (id) => {
        const r = await run('DELETE FROM respostas_formularios WHERE id=?', [id]);
        return r.affectedRows > 0;
    },
};

// ── vagas ─────────────────────────────────────────────────────────────────────
const vagasRepo = {
    getAll: async () => { const rows = await all('SELECT * FROM vagas ORDER BY created_at DESC'); return rows.map(r => { const dados = r.dados ? (typeof r.dados === 'string' ? JSON.parse(r.dados) : r.dados) : {}; return { ...dados, ...r, dados, ativa: r.ativa === 0 || r.ativa === false ? false : true }; }); },
    getById: async (id) => { const r = await get('SELECT * FROM vagas WHERE id = ?', [id]); if (!r) return null; const dados = r.dados ? (typeof r.dados === 'string' ? JSON.parse(r.dados) : r.dados) : {}; return { ...dados, ...r, dados }; },
    create: async (data) => { const { id, created_at, createdAt, status, ...rest } = data; const r = await run(`INSERT IGNORE INTO vagas (id,titulo,cargo,setor,descricao,status,motivo,sera_desligado,substituicao_id,data_desligamento,aprovado_por,dados,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, [id, data.titulo || data.cargo || null, data.cargo || null, data.setor || null, data.descricao || null, status || 'aberta', data.motivo || null, data.sera_desligado || null, data.substituicao_id || null, data.data_desligamento || null, data.aprovado_por || null, JSON.stringify(rest), toMySQLDatetime(createdAt || created_at || new Date())]); return { ...data, created: r.affectedRows > 0 }; },
    update: async (id, data) => { await run(`UPDATE vagas SET titulo=?,setor=?,descricao=?,status=?,ativa=?,updated_at=NOW() WHERE id=?`, [data.titulo || null, data.setor || null, data.descricao || null, data.status || null, data.ativa !== undefined ? (data.ativa ? 1 : 0) : null, id]); return data; },
    delete: async (id) => { const r = await run('DELETE FROM vagas WHERE id=?', [id]); return r.affectedRows > 0; },
};

// ── candidatos ────────────────────────────────────────────────────────────────
const candidatosRepo = {
    getAll: async () => { const rows = await all('SELECT * FROM candidatos ORDER BY created_at DESC'); return rows.map(r => ({ ...r, vagaId: r.vaga_id, comoSoube: r.como_soube, indicadoPorNome: r.indicado_por_nome, indicadoPorCargo: r.indicado_por_cargo, indicadoPorSetor: r.indicado_por_setor, estadoCivil: r.estado_civil, qtdFilhos: r.qtd_filhos, createdAt: r.created_at, updatedAt: r.updated_at, historico: r.historico ? (typeof r.historico === 'string' ? JSON.parse(r.historico) : r.historico) : [], dados: r.dados ? (typeof r.dados === 'string' ? JSON.parse(r.dados) : r.dados) : null })); },
    getById: async (id) => { const r = await get('SELECT * FROM candidatos WHERE id = ?', [id]); if (!r) return null; return { ...r, vagaId: r.vaga_id, comoSoube: r.como_soube, indicadoPorNome: r.indicado_por_nome, indicadoPorCargo: r.indicado_por_cargo, indicadoPorSetor: r.indicado_por_setor, estadoCivil: r.estado_civil, qtdFilhos: r.qtd_filhos, createdAt: r.created_at, updatedAt: r.updated_at, historico: r.historico ? (typeof r.historico === 'string' ? JSON.parse(r.historico) : r.historico) : [], dados: r.dados ? (typeof r.dados === 'string' ? JSON.parse(r.dados) : r.dados) : null }; },
    getByVaga: async (vagaId) => await all('SELECT * FROM candidatos WHERE vaga_id = ?', [vagaId]),
    create: async (data) => { const r = await run(`INSERT IGNORE INTO candidatos (id,vaga_id,nome,email,telefone,cpf,cargo,cargo1,cargo2,status,como_soube,indicado_por_nome,indicado_por_cargo,indicado_por_setor,curriculo,dados,historico,idade,estado_civil,endereco,bairro,cidade,estado,filhos,qtd_filhos,escolaridade,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [data.id, data.vaga_id || data.vagaId || null, data.nome, data.email || null, data.telefone || null, data.cpf || null, data.cargo || null, data.cargo1 || null, data.cargo2 || null, data.status || 'recebido', data.comoSoube || data.como_soube || null, data.indicadoPorNome || data.indicado_por_nome || null, data.indicadoPorCargo || data.indicado_por_cargo || null, data.indicadoPorSetor || data.indicado_por_setor || null, data.curriculo || null, data.dados ? JSON.stringify(data.dados) : null, data.historico ? JSON.stringify(data.historico) : null, data.idade || null, data.estadoCivil || data.estado_civil || null, data.endereco || null, data.bairro || null, data.cidade || null, data.estado || null, data.filhos || null, data.qtdFilhos != null ? data.qtdFilhos : (data.qtd_filhos != null ? data.qtd_filhos : null), data.escolaridade || null, toMySQLDatetime(data.createdAt || data.created_at || new Date())]); return { ...data, created: r.affectedRows > 0 }; },
    update: async (id, data) => { await run(`UPDATE candidatos SET nome=?,email=?,telefone=?,status=?,updated_at=NOW() WHERE id=?`, [data.nome, data.email || null, data.telefone || null, data.status, id]); return data; },
    delete: async (id) => { const r = await run('DELETE FROM candidatos WHERE id=?', [id]); return r.affectedRows > 0; },
};

// ── taxas ─────────────────────────────────────────────────────────────────────
const taxasRepo = {
    getAll: async () => await all('SELECT * FROM taxas ORDER BY created_at DESC'),
    getById: async (id) => await get('SELECT * FROM taxas WHERE id = ?', [id]),
    create: async (data) => { const r = await run(`INSERT IGNORE INTO taxas (id,funcionario_id,tipo,valor,status,created_at) VALUES (?,?,?,?,?,?)`, [data.id, data.funcionario_id || null, data.tipo, data.valor, data.status || 'pendente', toMySQLDatetime(data.created_at || new Date())]); return { ...data, created: r.affectedRows > 0 }; },
    update: async (id, data) => { await run(`UPDATE taxas SET status=?,updated_at=NOW() WHERE id=?`, [data.status, id]); return data; },
    delete: async (id) => { const r = await run('DELETE FROM taxas WHERE id=?', [id]); return r.affectedRows > 0; },
};

// ── solicitacoesTaxa ──────────────────────────────────────────────────────────
const solicitacoesTaxaRepo = {
    getAll: async () => await all('SELECT * FROM solicitacoes_taxa ORDER BY created_at DESC'),
    getById: async (id) => await get('SELECT * FROM solicitacoes_taxa WHERE id = ?', [id]),
    create: async (data) => { const r = await run(`INSERT IGNORE INTO solicitacoes_taxa (id,funcionario_id,tipo,valor,justificativa,status,created_at) VALUES (?,?,?,?,?,?,?)`, [data.id, data.funcionario_id || null, data.tipo, data.valor || null, data.justificativa || null, data.status || 'pendente', toMySQLDatetime(data.created_at || new Date())]); return { ...data, created: r.affectedRows > 0 }; },
    update: async (id, data) => { await run(`UPDATE solicitacoes_taxa SET status=?,updated_at=NOW() WHERE id=?`, [data.status, id]); return data; },
    delete: async (id) => { const r = await run('DELETE FROM solicitacoes_taxa WHERE id=?', [id]); return r.affectedRows > 0; },
};

// ── epis ──────────────────────────────────────────────────────────────────────
const episRepo = {
    getAll: async () => await all('SELECT * FROM epis'),
    getById: async (id) => await get('SELECT * FROM epis WHERE id = ?', [id]),
    create: async (data) => { const r = await run(`INSERT IGNORE INTO epis (id,nome,ca,tipo,estoque,created_at) VALUES (?,?,?,?,?,?)`, [data.id, data.nome, data.ca || null, data.tipo || null, data.estoque || 0, toMySQLDatetime(data.created_at || new Date())]); return { ...data, created: r.affectedRows > 0 }; },
    update: async (id, data) => { await run(`UPDATE epis SET nome=?,ca=?,tipo=?,estoque=?,updated_at=NOW() WHERE id=?`, [data.nome, data.ca || null, data.tipo || null, data.estoque || 0, id]); return data; },
    delete: async (id) => { const r = await run('DELETE FROM epis WHERE id=?', [id]); return r.affectedRows > 0; },
};

// ── movimentacoesEpis ─────────────────────────────────────────────────────────
const movimentacoesEpisRepo = {
    getAll: async () => await all('SELECT * FROM movimentacoes_epis ORDER BY created_at DESC'),
    getByFuncionario: async (funcId) => await all('SELECT * FROM movimentacoes_epis WHERE funcionario_id = ?', [funcId]),
    create: async (data) => { const r = await run(`INSERT INTO movimentacoes_epis (id,funcionario_id,epi_id,tipo,quantidade,created_at) VALUES (?,?,?,?,?,?)`, [data.id, data.funcionario_id, data.epi_id, data.tipo, data.quantidade || 1, toMySQLDatetime(data.created_at || new Date())]); return { ...data, created: r.affectedRows > 0 }; },
};

// ── uniformes ─────────────────────────────────────────────────────────────────
const uniformesRepo = {
    getAll: async () => await all('SELECT * FROM uniformes'),
    getById: async (id) => await get('SELECT * FROM uniformes WHERE id = ?', [id]),
    create: async (data) => { const r = await run(`INSERT IGNORE INTO uniformes (id,funcionario_id,tipo,tamanho,status,created_at) VALUES (?,?,?,?,?,?)`, [data.id, data.funcionario_id || null, data.tipo || null, data.tamanho || null, data.status || 'pendente', toMySQLDatetime(data.created_at || new Date())]); return { ...data, created: r.affectedRows > 0 }; },
    update: async (id, data) => { await run(`UPDATE uniformes SET status=?,updated_at=NOW() WHERE id=?`, [data.status, id]); return data; },
};

// ── movimentacoes ─────────────────────────────────────────────────────────────
const movimentacoesRepo = {
    getAll: async () => await all('SELECT * FROM movimentacoes ORDER BY created_at DESC'),
    getByFuncionario: async (funcId) => await all('SELECT * FROM movimentacoes WHERE funcionario_id = ?', [funcId]),
    create: async (data) => { const r = await run(`INSERT INTO movimentacoes (id,funcionario_id,tipo,descricao,created_at) VALUES (?,?,?,?,?)`, [data.id, data.funcionario_id, data.tipo, data.descricao || null, toMySQLDatetime(data.created_at || new Date())]); return { ...data, created: r.affectedRows > 0 }; },
};

// ── movimentacoesRh ───────────────────────────────────────────────────────────
const movimentacoesRhRepo = {
    getAll: async () => await all('SELECT * FROM movimentacoes_rh ORDER BY created_at DESC'),
    create: async (data) => { const r = await run(`INSERT INTO movimentacoes_rh (id,funcionario_id,tipo,descricao,created_at) VALUES (?,?,?,?,?)`, [data.id, data.funcionario_id, data.tipo, data.descricao || null, toMySQLDatetime(data.created_at || new Date())]); return { ...data, created: r.affectedRows > 0 }; },
};

// ── onthejob ──────────────────────────────────────────────────────────────────
const onthejobRepo = {
    getAll: async () => await all('SELECT * FROM onthejob ORDER BY created_at DESC'),
    getById: async (id) => await get('SELECT * FROM onthejob WHERE id = ?', [id]),
    create: async (data) => { const r = await run(`INSERT IGNORE INTO onthejob (id,funcionario_id,descricao,status,created_at) VALUES (?,?,?,?,?)`, [data.id, data.funcionario_id || null, data.descricao || null, data.status || 'ativo', toMySQLDatetime(data.created_at || new Date())]); return { ...data, created: r.affectedRows > 0 }; },
    update: async (id, data) => { await run(`UPDATE onthejob SET descricao=?,status=?,updated_at=NOW() WHERE id=?`, [data.descricao || null, data.status, id]); return data; },
    delete: async (id) => { const r = await run('DELETE FROM onthejob WHERE id=?', [id]); return r.affectedRows > 0; },
};

// ── recrutamentoInterno ───────────────────────────────────────────────────────
const recrutamentoInternoRepo = {
    getAll: async () => await all('SELECT * FROM recrutamento_interno ORDER BY created_at DESC'),
    getById: async (id) => await get('SELECT * FROM recrutamento_interno WHERE id = ?', [id]),
    create: async (data) => { const r = await run(`INSERT IGNORE INTO recrutamento_interno (id,funcionario_id,vaga_id,status,created_at) VALUES (?,?,?,?,?)`, [data.id, data.funcionario_id || null, data.vaga_id || null, data.status || 'inscrito', toMySQLDatetime(data.created_at || new Date())]); return { ...data, created: r.affectedRows > 0 }; },
    update: async (id, data) => { await run(`UPDATE recrutamento_interno SET status=?,updated_at=NOW() WHERE id=?`, [data.status, id]); return data; },
};

// ── beneficios ────────────────────────────────────────────────────────────────
const beneficiosRepo = {
    getAll: async () => await all('SELECT * FROM beneficios_registros ORDER BY data_referencia DESC'),
    getByCpf: async (cpf) => await all('SELECT * FROM beneficios_registros WHERE cpf = ? ORDER BY data_referencia DESC', [cpf]),
    create: async (data) => {
        const r = await run(
            `INSERT INTO beneficios_registros (id, cpf, tipo, valor, data_referencia, descricao, criado_por, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [data.id, data.cpf, data.tipo, data.valor || 0, data.data_referencia, data.descricao || null, data.criado_por || null, toMySQLDatetime(data.created_at || new Date())]
        );
        return { ...data, created: r.affectedRows > 0 };
    },
    delete: async (id) => { const r = await run('DELETE FROM beneficios_registros WHERE id=?', [id]); return r.affectedRows > 0; },
};

// ── disciplinarRegistros ──────────────────────────────────────────────────────
const disciplinarRegistrosRepo = {
    createIgnore: async (data) => { const r = await run(`INSERT IGNORE INTO disciplinar_registros (id,funcionario_id,tipo,descricao,status,created_at) VALUES (?,?,?,?,?,?)`, [data.id, data.funcionarioId || data.funcionario_id, data.tipo, data.descricao || null, data.status || 'ativo', toMySQLDatetime(data.createdAt || data.created_at || new Date())]); return { ...data, created: r.affectedRows > 0 }; },
    getAll: async () => { const rows = await all('SELECT * FROM disciplinar_registros ORDER BY created_at DESC'); return rows.map(r => ({ ...r, funcionarioId: r.funcionario_id, dataOcorrencia: r.data_ocorrencia, diasSuspensao: r.dias_suspensao, criadoPor: r.criado_por, createdAt: r.created_at, updatedAt: r.updated_at })); },
    getById: async (id) => await get('SELECT * FROM disciplinar_registros WHERE id = ?', [id]),
    getByFuncionario: async (funcId) => await all('SELECT * FROM disciplinar_registros WHERE funcionario_id = ?', [funcId]),
    create: async (data) => { const r = await run(`INSERT INTO disciplinar_registros (id,funcionario_id,tipo,motivo,descricao,data_ocorrencia,dias_suspensao,status,criado_por,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`, [data.id, data.funcionarioId || data.funcionario_id, data.tipo, data.motivo || null, data.descricao || null, data.dataOcorrencia || data.data_ocorrencia || null, data.diasSuspensao ?? data.dias_suspensao ?? null, data.status || 'ativo', data.criadoPor || data.criado_por || null, toMySQLDatetime(data.createdAt || data.created_at || new Date())]); return { ...data, created: r.affectedRows > 0 }; },
    update: async (id, data) => { await run(`UPDATE disciplinar_registros SET funcionario_id=COALESCE(?,funcionario_id),tipo=COALESCE(?,tipo),descricao=COALESCE(?,descricao),status=COALESCE(?,status),updated_at=NOW() WHERE id=?`, [data.funcionarioId || data.funcionario_id || null, data.tipo || null, data.descricao !== undefined ? data.descricao : null, data.status || null, id]); return data; },
    delete: async (id) => { const r = await run('DELETE FROM disciplinar_registros WHERE id=?', [id]); return r.affectedRows > 0; },
};

// ── entrevistasDesligamento ───────────────────────────────────────────────────
const entrevistasDesligamentoRepo = {
    getAll: async () => await all('SELECT * FROM entrevistas_desligamento ORDER BY created_at DESC'),
    getById: async (id) => await get('SELECT * FROM entrevistas_desligamento WHERE id = ?', [id]),
    create: async (data) => { const r = await run(`INSERT IGNORE INTO entrevistas_desligamento (id,funcionario_id,nome,setor,cargo,data_admissao,data_desligamento,tipo_desligamento,motivo_desligamento,motivo,respostas,dados,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, [data.id, data.funcionario_id || null, data.nome || null, data.setor || null, data.cargo || null, data.data_admissao || null, data.data_desligamento || null, data.tipo_desligamento || null, data.motivo_desligamento || null, data.motivo || null, JSON.stringify(data.respostas || {}), data.dados ? JSON.stringify(data.dados) : null, toMySQLDatetime(data.createdAt || data.created_at || new Date())]); return { ...data, created: r.affectedRows > 0 }; },
    update: async (id, data) => { await run(`UPDATE entrevistas_desligamento SET respostas=?,updated_at=NOW() WHERE id=?`, [JSON.stringify(data.respostas || {}), id]); return data; },
};

// ── acessos ───────────────────────────────────────────────────────────────────
const acessosRepo = {
    getAll: async () => await all('SELECT * FROM acessos ORDER BY created_at DESC'),
    getByFuncionario: async (funcId) => await all('SELECT * FROM acessos WHERE funcionario_id = ?', [funcId]),
    create: async (data) => { const r = await run(`INSERT INTO acessos (id,funcionario_id,tipo,descricao,created_at) VALUES (?,?,?,?,?)`, [data.id, data.funcionario_id, data.tipo, data.descricao || null, toMySQLDatetime(data.created_at || new Date())]); return { ...data, created: r.affectedRows > 0 }; },
};

// ── setores ───────────────────────────────────────────────────────────────────
const normSetorNome = (v) => String(v || '').trim();

const setoresRepo = {
    getAll: async ({ includeInactive = false } = {}) => {
        const rows = await all(
            includeInactive
                ? 'SELECT nome, ativo, created_at, updated_at FROM setores ORDER BY nome'
                : 'SELECT nome, ativo, created_at, updated_at FROM setores WHERE ativo = 1 ORDER BY nome'
        );
        return (rows || []).map(r => ({
            nome: r.nome,
            ativo: r.ativo === undefined || r.ativo === null ? true : !!Number(r.ativo),
            created_at: r.created_at,
            updated_at: r.updated_at,
        }));
    },

    syncFromFuncionarios: async () => {
        const funcs = await all(
            "SELECT DISTINCT TRIM(setor) AS setor FROM funcionarios WHERE setor IS NOT NULL AND TRIM(setor) != ''"
        );
        let inserted = 0;
        for (const f of funcs || []) {
            const nome = normSetorNome(f && f.setor);
            if (!nome) continue;
            const r = await run('INSERT IGNORE INTO setores (nome, ativo) VALUES (?, 1)', [nome]);
            if (r.affectedRows > 0) inserted++;
        }
        return inserted;
    },

    create: async (nome) => {
        const n = normSetorNome(typeof nome === 'string' ? nome : (nome && nome.nome));
        if (!n) throw new Error('nome é obrigatório');
        await run('INSERT IGNORE INTO setores (nome, ativo) VALUES (?, 1)', [n]);
        return { nome: n };
    },

    rename: async (oldNome, newNome) => {
        const oldN = normSetorNome(oldNome);
        const newN = normSetorNome(newNome);
        if (!oldN || !newN) throw new Error('Nome inválido');
        if (oldN === newN) return { nome: newN, renamed: false };

        const oldRow = await get('SELECT ativo FROM setores WHERE nome = ?', [oldN]);
        await run('INSERT IGNORE INTO setores (nome, ativo) VALUES (?, ?)', [newN, oldRow ? Number(oldRow.ativo) : 1]);
        await run('UPDATE funcionarios SET setor = ?, updated_at = NOW() WHERE TRIM(setor) = ?', [newN, oldN]);
        await run('UPDATE gestor_setores SET setor = ? WHERE setor = ?', [newN, oldN]);
        await run('DELETE FROM setores WHERE nome = ?', [oldN]);
        return { nome: newN, renamed: true };
    },

    setActive: async (nome, ativo) => {
        const n = normSetorNome(nome);
        if (!n) throw new Error('Nome inválido');
        await run('INSERT IGNORE INTO setores (nome, ativo) VALUES (?, 1)', [n]);
        await run('UPDATE setores SET ativo = ?, updated_at = NOW() WHERE nome = ?', [ativo ? 1 : 0, n]);
    },

    listColaboradorIds: async (nomeSetor) => {
        const setor = normSetorNome(nomeSetor);
        if (!setor) return [];
        const rows = await all(
            'SELECT id FROM funcionarios WHERE TRIM(setor) = ?',
            [setor]
        );
        return (rows || []).map(r => String(r.id || '').trim()).filter(Boolean);
    },

    setColaboradores: async (nomeSetor, funcionarioIds) => {
        const setor = normSetorNome(nomeSetor);
        if (!setor) throw new Error('Setor inválido');

        await run('INSERT IGNORE INTO setores (nome, ativo) VALUES (?, 1)', [setor]);

        const desired = new Set(
            (Array.isArray(funcionarioIds) ? funcionarioIds : [])
                .map(id => String(id || '').trim())
                .filter(Boolean)
        );

        const currentRows = await all(
            'SELECT id FROM funcionarios WHERE TRIM(setor) = ?',
            [setor]
        );
        const currentIds = new Set((currentRows || []).map(r => String(r.id || '').trim()).filter(Boolean));

        let adicionados = 0;
        let removidos = 0;

        for (const id of desired) {
            if (currentIds.has(id)) continue;
            const f = await funcionariosRepo.getById(id);
            if (!f) continue;
            await funcionariosRepo.update(id, { ...f, setor });
            adicionados++;
        }

        for (const id of currentIds) {
            if (desired.has(id)) continue;
            const f = await funcionariosRepo.getById(id);
            if (!f) continue;
            await funcionariosRepo.update(id, { ...f, setor: null });
            removidos++;
        }

        await syncAvaliadoSetorParticipantes(setor, desired);
        for (const id of currentIds) {
            if (!desired.has(id)) await syncAvaliadoSetorParticipantes(null, new Set([id]));
        }

        return { setor, total: desired.size, adicionados, removidos };
    },
};

async function syncAvaliadoSetorParticipantes(setorNome, idSet) {
    const setorVal = setorNome ? normSetorNome(setorNome) : null;
    for (const id of idSet || []) {
        const fid = String(id || '').trim();
        if (!fid) continue;
        await run(
            'UPDATE avaliacao_participantes SET avaliado_setor = ? WHERE avaliado_id = ?',
            [setorVal, fid]
        );
    }
}

// ── notifications ─────────────────────────────────────────────────────────────
const notificationsRepo = {
    getAll: async () => await all('SELECT * FROM notifications ORDER BY created_at DESC'),
    getByUser: async (username) => await all('SELECT * FROM notifications WHERE username = ? ORDER BY created_at DESC', [username]),
    listByUser: async (username) => await all('SELECT * FROM notifications WHERE username = ? ORDER BY created_at DESC', [username]),
    create: async (data) => { const r = await run(`INSERT INTO notifications (id,username,tipo,titulo,mensagem,link,created_at) VALUES (?,?,?,?,?,?,?)`, [data.id, data.username, data.tipo, data.titulo || null, data.mensagem, data.link || null, toMySQLDatetime(data.created_at || new Date())]); return { ...data, created: r.affectedRows > 0 }; },
    marcarLida: async (params) => {
        if (params && typeof params === 'object' && ('all' in params || 'ids' in params)) {
            const { username, ids, all } = params;
            if (all) {
                await run('UPDATE notifications SET read_at=NOW() WHERE username=? AND read_at IS NULL', [username]);
            } else if (Array.isArray(ids) && ids.length > 0) {
                for (const id of ids) await run('UPDATE notifications SET read_at=NOW() WHERE id=? AND username=?', [id, username]);
            }
            return { ok: true };
        }
        await run('UPDATE notifications SET read_at=NOW() WHERE id=?', [params]);
        return { ok: true };
    },
    countUnread: async (username) => { const r = await get('SELECT COUNT(*) as n FROM notifications WHERE username = ? AND read_at IS NULL', [username]); return r ? Number(r.n) : 0; },
    markAllRead: async (username) => { await run('UPDATE notifications SET read_at=NOW() WHERE username=?', [username]); },
    delete: async (id) => { const r = await run('DELETE FROM notifications WHERE id=?', [id]); return r.affectedRows > 0; },
};

// ── disciplinarModelos ────────────────────────────────────────────────────────
const disciplinarModelosRepo = {
    getAll: async () => await all('SELECT * FROM disciplinar_modelos ORDER BY created_at DESC'),
    getById: async (id) => await get('SELECT * FROM disciplinar_modelos WHERE id = ?', [id]),
    create: async (data) => { const r = await run(`INSERT IGNORE INTO disciplinar_modelos (id,nome,tipo,conteudo,created_at) VALUES (?,?,?,?,?)`, [data.id, data.nome, data.tipo || null, data.conteudo || null, toMySQLDatetime(data.created_at || new Date())]); return { ...data, created: r.affectedRows > 0 }; },
    update: async (id, data) => { await run(`UPDATE disciplinar_modelos SET nome=?,tipo=?,conteudo=?,updated_at=NOW() WHERE id=?`, [data.nome, data.tipo || null, data.conteudo || null, id]); return data; },
    delete: async (id) => { const r = await run('DELETE FROM disciplinar_modelos WHERE id=?', [id]); return r.affectedRows > 0; },
};

// ── auditoria ─────────────────────────────────────────────────────────────────
const auditoriaRepo = {
    getAll: async () => await all('SELECT * FROM auditoria_logs ORDER BY created_at DESC'),
    create: async (data) => { const r = await run(`INSERT INTO auditoria_logs (id,username,acao,detalhes,created_at) VALUES (?,?,?,?,?)`, [data.id, data.username, data.acao, data.detalhes || null, toMySQLDatetime(data.created_at || new Date())]); return { ...data, created: r.affectedRows > 0 }; },
};

// ── sql (helper direto para queries customizadas) ─────────────────────────────
const sqlHelper = {
    query: async (sql, params = []) => await all(sql, params),
    all: async (sql, params = []) => await all(sql, params),
    get: async (sql, params = []) => await get(sql, params),
    run: async (sql, params = []) => await run(sql, params),
};


// ── intranet ──────────────────────────────────────────────────────────────────
const intranetRepo = {
    feed: async ({ limit = 20, tipo } = {}) => {
        const params = [];
        let where = '';
        if (tipo && tipo !== 'todos') { where = 'WHERE tipo = ?'; params.push(tipo); }
        const lim = Number(limit) || 20;
        return await all(`SELECT * FROM intranet_posts ${where} ORDER BY created_at DESC LIMIT ${lim}`, params);
    },
    getPostById: async (id) => await get('SELECT * FROM intranet_posts WHERE id = ?', [id]),
    createPost: async (data) => {
        const r = await run(
            `INSERT INTO intranet_posts (id,tipo,titulo,conteudo,imagem_url,autor_username,autor_nome,autor_role,created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
            [data.id, data.tipo || 'aviso', data.titulo, data.conteudo || null, data.imagem_url || null, data.autor_username || null, data.autor_nome || null, data.autor_role || null, toMySQLDatetime(data.created_at || new Date())]
        );
        return { ...data, created: r.affectedRows > 0 };
    },
    updatePost: async (id, data) => {
        await run(`UPDATE intranet_posts SET tipo=?,titulo=?,conteudo=?,imagem_url=?,updated_at=NOW() WHERE id=?`,
            [data.tipo, data.titulo, data.conteudo || null, data.imagem_url || null, id]);
        return data;
    },
    deletePost: async (id) => { const r = await run('DELETE FROM intranet_posts WHERE id=?', [id]); return r.affectedRows > 0; },

    listEvents: async ({ from, limit = 20 } = {}) => {
        const params = [];
        let where = '';
        if (from) { where = 'WHERE data_inicio >= ?'; params.push(from); }
        const lim = Number(limit) || 20;
        return await all(`SELECT * FROM intranet_events ${where} ORDER BY data_inicio ASC LIMIT ${lim}`, params);
    },
    getEventById: async (id) => await get('SELECT * FROM intranet_events WHERE id = ?', [id]),
    createEvent: async (data) => {
        const r = await run(
            `INSERT INTO intranet_events (id,titulo,descricao,data_inicio,data_fim,local,criado_por,created_at) VALUES (?,?,?,?,?,?,?,?)`,
            [data.id, data.titulo, data.descricao || null, data.data_inicio, data.data_fim || null, data.local || null, data.criado_por || null, toMySQLDatetime(data.created_at || new Date())]
        );
        return { ...data, created: r.affectedRows > 0 };
    },
    updateEvent: async (id, data) => {
        await run(`UPDATE intranet_events SET titulo=?,descricao=?,data_inicio=?,data_fim=?,local=?,updated_at=NOW() WHERE id=?`,
            [data.titulo, data.descricao || null, data.data_inicio, data.data_fim || null, data.local || null, id]);
        return data;
    },
    deleteEvent: async (id) => { const r = await run('DELETE FROM intranet_events WHERE id=?', [id]); return r.affectedRows > 0; },
};

const avaliacaoAssinaturasRepo = {
    ensureTable: async () => {
        try {
            await run(`
                CREATE TABLE IF NOT EXISTS avaliacao_assinaturas (
                    avaliacao_id VARCHAR(255) NOT NULL,
                    periodo VARCHAR(10) NOT NULL DEFAULT '90',
                    gestor TEXT,
                    colaborador TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME,
                    PRIMARY KEY (avaliacao_id, periodo)
                )
            `);
            console.log('✅ Tabela avaliacao_assinaturas verificada/criada');
        } catch (err) {
            console.error('Erro ao criar tabela avaliacao_assinaturas:', err);
        }
    },

    upsert: async (avaliacaoId, gestor, colaborador, periodo = '90') => {
        await avaliacaoAssinaturasRepo.ensureTable();

        const existing = await get(
            'SELECT * FROM avaliacao_assinaturas WHERE avaliacao_id = ? AND periodo = ?',
            [avaliacaoId, periodo]
        );

        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

        if (existing) {
            await run(
                `UPDATE avaliacao_assinaturas 
                 SET gestor = ?, colaborador = ?, updated_at = ? 
                 WHERE avaliacao_id = ? AND periodo = ?`,
                [JSON.stringify(gestor), JSON.stringify(colaborador), now, avaliacaoId, periodo]
            );
        } else {
            await run(
                `INSERT INTO avaliacao_assinaturas (avaliacao_id, periodo, gestor, colaborador, updated_at, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [avaliacaoId, periodo, JSON.stringify(gestor), JSON.stringify(colaborador), now, now]
            );
        }
        return true;
    },

    getByAvaliacaoId: async (avaliacaoId) => {
        await avaliacaoAssinaturasRepo.ensureTable();

        const rows = await all(
            'SELECT * FROM avaliacao_assinaturas WHERE avaliacao_id = ?',
            [avaliacaoId]
        );

        return (rows || []).map(row => {
            if (row.gestor) {
                try { row.gestor = JSON.parse(row.gestor); } catch (e) { row.gestor = null; }
            }
            if (row.colaborador) {
                try { row.colaborador = JSON.parse(row.colaborador); } catch (e) { row.colaborador = null; }
            }
            return row;
        });
    }
};

// ─── Função de inicialização (compatível com server.js) ───────────────────────
/**
 * Chamada pelo server.js como: db = await dbInitializer()
 * Valida a conexão e devolve o objeto db completo.
 */
async function init() {
    await ping();
    await ensureGestorSetoresSchema();
    console.log('✅ MySQL: conexão validada.');

    return {
        // Helpers diretos
        pool,
        run,
        get,
        all,
        ping,

        // Utilitários
        parseJsonFields,
        normalizeFormularioQuestoes,
        normalizeNumericIdValue,
        countRows,
        purgeTestData,

        // Repositórios
        funcionarios: funcionariosRepo,
        solicitacoes: solicitacoesRepo,
        users: usersRepo,
        rolePermissions: rolePermissionsRepo,
        avaliacoes: avaliacoesRepo,
        avaliacaoCiclos: avaliacaoCiclosRepo,
        avaliacaoParticipantes: avaliacaoParticipantesRepo,
        avaliacaoPrazos: avaliacaoPrazosRepo,
        avaliacaoConsolidado: avaliacaoConsolidadoRepo,
        avaliacaoAssinaturas: avaliacaoAssinaturasRepo,
        gestorEquipes: gestorEquipesRepo,
        gestorSetores: gestorSetoresRepo,
        dashboardsFormularios: dashboardsFormulariosRepo,
        formularios: formulariosRepo,
        respostas: respostasRepo,
        vagas: vagasRepo,
        candidatos: candidatosRepo,
        taxas: taxasRepo,
        solicitacoesTaxa: solicitacoesTaxaRepo,
        epis: episRepo,
        movimentacoesEpis: movimentacoesEpisRepo,
        uniformes: uniformesRepo,
        movimentacoes: movimentacoesRepo,
        movimentacoesRh: movimentacoesRhRepo,
        beneficios: beneficiosRepo,
        onthejob: onthejobRepo,
        recrutamentoInterno: recrutamentoInternoRepo,
        disciplinarRegistros: disciplinarRegistrosRepo,
        entrevistasDesligamento: entrevistasDesligamentoRepo,
        acessos: acessosRepo,
        setores: setoresRepo,
        notifications: notificationsRepo,
        disciplinarModelos: disciplinarModelosRepo,
        auditoria: auditoriaRepo,
        auditLogs: auditLogsRepo,
        sessionTokens: sessionTokensRepo,
        sql: sqlHelper,
        intranet: intranetRepo,

    };
}

// ── avaliacaoAssinaturas ──────────────────────────────────────────────────────

// ── avaliacaoAssinaturas ──────────────────────────────────────────────────────


module.exports = init;
