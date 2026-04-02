const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'database', 'formularios.db');
const DB_DIR = path.dirname(DB_PATH);

if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

// --- SQLite Helpers ---
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) console.error('Erro ao conectar ao SQLite:', err.message);
    else console.log('Conectado ao banco de dados SQLite.');
});

db.run('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS funcionarios (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    cpf TEXT UNIQUE,
    matricula TEXT,
    cargo TEXT,
    setor TEXT,
    data_admissao TEXT,
    nascimento TEXT,
    sexo TEXT,
    raca_cor TEXT,
    nacionalidade TEXT,
    tipo_vinculo TEXT,
    banco TEXT,
    agencia TEXT,
    conta TEXT,
    tipo_conta TEXT,
    chave_pix TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_funcionarios_cpf ON funcionarios(cpf);
CREATE INDEX IF NOT EXISTS idx_funcionarios_matricula ON funcionarios(matricula);
`, (err) => {
    if (err) console.error('Erro ao preparar tabela funcionarios:', err);
});

db.exec(`
CREATE TABLE IF NOT EXISTS solicitacoes_epis (
    id TEXT PRIMARY KEY,
    funcionario_id TEXT NOT NULL,
    tipo TEXT DEFAULT 'retirada',
    itens_solicitados TEXT NOT NULL,
    status TEXT DEFAULT 'pendente',
    atendido_at DATETIME,
    atendido_por TEXT,
    assinatura TEXT,
    assinatura_tipo TEXT,
    assinatura_at DATETIME,
    assinatura_por TEXT,
    evidencia_foto TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_epis_status_created ON solicitacoes_epis(status, created_at);
CREATE INDEX IF NOT EXISTS idx_solicitacoes_epis_funcionario_created ON solicitacoes_epis(funcionario_id, created_at);
`, (err) => {
    if (err) console.error('Erro ao preparar tabela solicitacoes_epis:', err);
});

db.exec(`
CREATE TABLE IF NOT EXISTS gestor_equipes (
    gestor_username TEXT NOT NULL,
    funcionario_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (gestor_username, funcionario_id)
);
CREATE INDEX IF NOT EXISTS idx_gestor_equipes_gestor ON gestor_equipes(gestor_username);
CREATE INDEX IF NOT EXISTS idx_gestor_equipes_func ON gestor_equipes(funcionario_id);
`, (err) => {
    if (err) console.error('Erro ao preparar tabela gestor_equipes:', err);
});

db.exec(`
CREATE TABLE IF NOT EXISTS gestor_setores (
    gestor_username TEXT NOT NULL,
    setor TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (gestor_username, setor)
);
CREATE INDEX IF NOT EXISTS idx_gestor_setores_gestor ON gestor_setores(gestor_username);
`, (err) => {
    if (err) console.error('Erro ao preparar tabela gestor_setores:', err);
});

db.exec(`
CREATE TABLE IF NOT EXISTS disciplinar_registros (
    id TEXT PRIMARY KEY,
    funcionario_id TEXT NOT NULL,
    tipo TEXT NOT NULL,
    dados TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(funcionario_id) REFERENCES funcionarios(id)
);
CREATE INDEX IF NOT EXISTS idx_disciplinar_funcionario_created ON disciplinar_registros(funcionario_id, created_at);
CREATE INDEX IF NOT EXISTS idx_disciplinar_tipo_created ON disciplinar_registros(tipo, created_at);
`, (err) => {
    if (err) console.error('Erro ao preparar tabela disciplinar_registros:', err);
});

db.exec(`
CREATE TABLE IF NOT EXISTS formularios_dashboards (
    id TEXT PRIMARY KEY,
    titulo TEXT,
    tipo TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_form_dashboards_tipo_updated ON formularios_dashboards(tipo, updated_at);
`, (err) => {
    if (err) console.error('Erro ao preparar tabela formularios_dashboards:', err);
});

db.exec(`
CREATE TABLE IF NOT EXISTS role_permissions (
    role TEXT PRIMARY KEY,
    protected_paths TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`, (err) => {
    if (err) console.error('Erro ao preparar tabela role_permissions:', err);
});

db.serialize(() => {
    db.all(`PRAGMA table_info(funcionarios)`, (err, rows) => {
        if (err || !Array.isArray(rows)) return;
        const cols = new Set(rows.map(r => r && r.name).filter(Boolean));
        const toAdd = [
            ['data_admissao', 'TEXT'],
            ['nascimento', 'TEXT'],
            ['sexo', 'TEXT'],
            ['raca_cor', 'TEXT'],
            ['nacionalidade', 'TEXT'],
            ['tipo_vinculo', 'TEXT']
        ];
        toAdd.forEach(([name, type]) => {
            if (cols.has(name)) return;
            db.run(`ALTER TABLE funcionarios ADD COLUMN ${name} ${type}`, () => {});
        });
    });

    db.all(`PRAGMA table_info(solicitacoes_epis)`, (err, rows) => {
        if (err || !Array.isArray(rows)) return;
        const cols = new Set(rows.map(r => r && r.name).filter(Boolean));
        const toAdd = [
            ['assinatura', 'TEXT'],
            ['assinatura_tipo', 'TEXT'],
            ['assinatura_at', 'DATETIME'],
            ['assinatura_por', 'TEXT'],
            ['evidencia_foto', 'TEXT'],
            ['tipo', `TEXT DEFAULT 'retirada'`]
        ];
        toAdd.forEach(([name, type]) => {
            if (cols.has(name)) return;
            db.run(`ALTER TABLE solicitacoes_epis ADD COLUMN ${name} ${type}`, () => {});
        });
    });

    db.all(`PRAGMA table_info(users)`, (err, rows) => {
        if (err || !Array.isArray(rows)) return;
        const cols = new Set(rows.map(r => r && r.name).filter(Boolean));
        const toAdd = [
            ['email', 'TEXT']
        ];
        toAdd.forEach(([name, type]) => {
            if (cols.has(name)) return;
            db.run(`ALTER TABLE users ADD COLUMN ${name} ${type}`, () => {});
        });
    });

    db.all(`PRAGMA table_info(taxas)`, (err, rows) => {
        if (err || !Array.isArray(rows)) return;
        const cols = new Set(rows.map(r => r && r.name).filter(Boolean));
        const toAdd = [
            ['aprovador_nome', 'TEXT'],
            ['aprovador_username', 'TEXT'],
            ['approval_token', 'TEXT']
        ];
        toAdd.forEach(([name, type]) => {
            if (cols.has(name)) return;
            db.run(`ALTER TABLE taxas ADD COLUMN ${name} ${type}`, () => {});
        });
    });

    db.all(`PRAGMA table_info(movimentacoes_epis)`, (err, rows) => {
        if (err || !Array.isArray(rows)) return;
        const cols = new Set(rows.map(r => r && r.name).filter(Boolean));
        const toAdd = [
            ['evidencia', 'TEXT'],
            ['tipo_evidencia', 'TEXT'],
            ['termo', 'TEXT']
        ];
        toAdd.forEach(([name, type]) => {
            if (cols.has(name)) return;
            db.run(`ALTER TABLE movimentacoes_epis ADD COLUMN ${name} ${type}`, () => {});
        });
    });

    db.all(`PRAGMA table_info(epis)`, (err, rows) => {
        if (err || !Array.isArray(rows)) return;
        const cols = new Set(rows.map(r => r && r.name).filter(Boolean));
        if (!cols.has('possui_ca')) {
            db.run(`ALTER TABLE epis ADD COLUMN possui_ca INTEGER DEFAULT 1`, () => {});
        }
    });

    db.all(`PRAGMA table_info(formularios)`, (err, rows) => {
        if (err || !Array.isArray(rows)) return;
        const hasDashboardId = rows.some(r => r && r.name === 'dashboard_id');
        if (!hasDashboardId) {
            db.run(`ALTER TABLE formularios ADD COLUMN dashboard_id TEXT`, () => {
                db.run(`UPDATE formularios SET dashboard_id = id WHERE dashboard_id IS NULL OR dashboard_id = ''`);
                db.run(`CREATE INDEX IF NOT EXISTS idx_formularios_dashboard_id ON formularios(dashboard_id)`);
                db.run(`
                    INSERT OR IGNORE INTO formularios_dashboards (id, titulo, tipo, created_at, updated_at)
                    SELECT dashboard_id, titulo, tipo, MIN(created_at), MAX(updated_at)
                    FROM formularios
                    WHERE dashboard_id IS NOT NULL AND dashboard_id <> ''
                    GROUP BY dashboard_id
                `);
            });
        } else {
            db.run(`UPDATE formularios SET dashboard_id = id WHERE dashboard_id IS NULL OR dashboard_id = ''`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_formularios_dashboard_id ON formularios(dashboard_id)`);
            db.run(`
                INSERT OR IGNORE INTO formularios_dashboards (id, titulo, tipo, created_at, updated_at)
                SELECT dashboard_id, titulo, tipo, MIN(created_at), MAX(updated_at)
                FROM formularios
                WHERE dashboard_id IS NOT NULL AND dashboard_id <> ''
                GROUP BY dashboard_id
            `);
        }
    });
});

const run = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
    });
});

const get = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

const all = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

const normalizeFormularioQuestoes = (questoes) => {
    if (!Array.isArray(questoes)) return [];
    return questoes.map((q) => {
        const base = (q && typeof q === 'object') ? { ...q } : {};
        const question = typeof base.question === 'string' && base.question.trim()
            ? base.question
            : (typeof base.text === 'string' ? base.text : '');

        const type = typeof base.type === 'string' && base.type.trim() ? base.type : 'text';
        const required = !!base.required;
        const category = typeof base.category === 'string' ? base.category : '';

        const normalized = {
            ...base,
            question,
            text: question,
            type,
            required,
            category
        };

        if (type === 'select' || type === 'multi') {
            normalized.options = Array.isArray(base.options) ? base.options.map(o => String(o)) : [];
        } else {
            delete normalized.options;
        }

        return normalized;
    });
};

// Helper to parse JSON fields from DB
const parseJsonFields = (row, fields = []) => {
    if (!row) return row;
    const newRow = { ...row };
    fields.forEach(f => {
        if (newRow[f]) {
            try {
                newRow[f] = JSON.parse(newRow[f]);
            } catch (e) {
                newRow[f] = null; // or keep original string
            }
        }
    });
    return newRow;
};

const countRows = async (tableName) => {
    const row = await get(`SELECT COUNT(*) as count FROM ${tableName}`);
    return row ? row.count : 0;
};

const ping = async () => {
    await get('SELECT 1 as ok');
    return true;
};

const purgeTestData = async ({ preserveFuncionarios = true } = {}) => {
    const tablesToClear = [
        'historico_solicitacoes',
        'solicitacoes_ferias',
        'taxas',
        'candidatos',
        'vagas',
        'movimentacoes_epis',
        'solicitacoes_epis',
        'descontos_epis',
        'movimentacoes',
        'epis',
        'entrevistas_desligamento',
        'recrutamento_interno',
        'onthejob',
        'disciplinar_registros',
        'avaliacoes',
        'acessos',
        'uniformes'
    ];

    if (!preserveFuncionarios) {
        tablesToClear.push('funcionarios');
    }

    const countsBefore = {};
    for (const tableName of tablesToClear) {
        countsBefore[tableName] = await countRows(tableName);
    }

    await run('BEGIN TRANSACTION');
    try {
        for (const tableName of tablesToClear) {
            await run(`DELETE FROM ${tableName}`);
        }

        await run(`DELETE FROM sqlite_sequence WHERE name IN ('acessos','historico_solicitacoes')`);
        await run('COMMIT');
    } catch (e) {
        try {
            await run('ROLLBACK');
        } catch (_) {}
        throw e;
    }

    const countsAfter = {};
    for (const tableName of tablesToClear) {
        countsAfter[tableName] = await countRows(tableName);
    }

    return { ok: true, preserveFuncionarios, countsBefore, countsAfter };
};

// --- Repositories ---

const solicitacoesRepo = {
    getAll: async () => {
        const rows = await all('SELECT * FROM solicitacoes_ferias');
        // Fetch historico for all (optimized)
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
            historico: historyMap[r.id] || []
        }));
    },
    getById: async (id) => {
        const row = await get('SELECT * FROM solicitacoes_ferias WHERE id = ?', [id]);
        if (!row) return null;
        const history = await all('SELECT * FROM historico_solicitacoes WHERE solicitacao_id = ? ORDER BY data', [id]);
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
            historico: history 
        };
    },
    create: async (data) => {
        const { 
            id, nome, setor, inicio, inicio2, tipoGozo, decimo, gestorEmail, nomeGestor, 
            status, statusRH, sugestaoData, justificativa, assinatura, signatureToken, signedAt, createdAt, updatedAt, historico 
        } = data;
        const funcionarioId = data.funcionarioId || data.funcionario_id || null;
        
        await run(`INSERT INTO solicitacoes_ferias (
            id, funcionario_id, nome, setor, inicio, inicio2, tipo_gozo, decimo, gestor_email, nome_gestor, 
            status, status_rh, sugestao_data, justificativa, assinatura, signature_token, signed_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            id, funcionarioId, nome, setor, inicio, inicio2, tipoGozo, decimo, gestorEmail, nomeGestor,
            status, statusRH, sugestaoData, justificativa, assinatura, signatureToken, signedAt, createdAt, updatedAt
        ]);

        if (historico && Array.isArray(historico)) {
            for (const h of historico) {
                await run(`INSERT INTO historico_solicitacoes (solicitacao_id, data, acao, ator, justificativa) VALUES (?, ?, ?, ?, ?)`, 
                    [id, h.data, h.acao, h.ator, h.justificativa]);
            }
        }
        return data;
    },
    update: async (id, data) => {
        // Assumes data contains all fields or partial?
        // For simplicity, let's update specific fields if provided, or mapped ones.
        // But usually usage is: read object, modify, save object.
        // So 'data' has everything.
        
        const { 
            nome, setor, inicio, inicio2, tipoGozo, decimo, gestorEmail, nomeGestor, 
            status, statusRH, sugestaoData, justificativa, assinatura, signatureToken, signedAt, updatedAt 
        } = data;
        const funcionarioId = data.funcionarioId || data.funcionario_id || null;

        await run(`UPDATE solicitacoes_ferias SET 
            funcionario_id=?, nome=?, setor=?, inicio=?, inicio2=?, tipo_gozo=?, decimo=?, gestor_email=?, nome_gestor=?, 
            status=?, status_rh=?, sugestao_data=?, justificativa=?, assinatura=?, signature_token=?, signed_at=?, updated_at=?
            WHERE id=?`, [
            funcionarioId, nome, setor, inicio, inicio2, tipoGozo, decimo, gestorEmail, nomeGestor,
            status, statusRH, sugestaoData, justificativa, assinatura, signatureToken, signedAt, updatedAt, id
        ]);

        // Re-sync historico? Or just add new ones?
        // The previous code pushed to array. 
        // Simplest strategy: Delete all history for this ID and re-insert. (Safe for small history)
        if (data.historico) {
            await run('DELETE FROM historico_solicitacoes WHERE solicitacao_id = ?', [id]);
            for (const h of data.historico) {
                 await run(`INSERT INTO historico_solicitacoes (solicitacao_id, data, acao, ator, justificativa) VALUES (?, ?, ?, ?, ?)`, 
                    [id, h.data, h.acao, h.ator, h.justificativa]);
            }
        }
        return data;
    },
    // Legacy support for gradual migration if needed (throws error to force update)
    read: () => { throw new Error("Use async getAll() or getById() for solicitacoes"); },
    write: () => { throw new Error("Use async create() or update() for solicitacoes"); }
};

const funcionariosRepo = {
    getAll: async () => await all('SELECT * FROM funcionarios'),
    getById: async (id) => await get('SELECT * FROM funcionarios WHERE id = ?', [id]),
    create: async (data) => {
        await run(`INSERT INTO funcionarios (id, nome, cpf, matricula, cargo, setor, data_admissao, nascimento, sexo, raca_cor, nacionalidade, tipo_vinculo, banco, agencia, conta, tipo_conta, chave_pix) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
                data.id,
                data.nome,
                data.cpf,
                data.matricula,
                data.cargo,
                data.setor,
                data.data_admissao || null,
                data.nascimento || null,
                data.sexo || null,
                data.raca_cor || null,
                data.nacionalidade || null,
                data.tipo_vinculo || null,
                data.banco,
                data.agencia,
                data.conta,
                data.tipo_conta,
                data.chave_pix
            ]);
        return data;
    },
    update: async (id, data) => {
        await run(`UPDATE funcionarios SET nome=?, cpf=?, matricula=?, cargo=?, setor=?, data_admissao=?, nascimento=?, sexo=?, raca_cor=?, nacionalidade=?, tipo_vinculo=?, banco=?, agencia=?, conta=?, tipo_conta=?, chave_pix=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
            [
                data.nome,
                data.cpf,
                data.matricula,
                data.cargo,
                data.setor,
                data.data_admissao || null,
                data.nascimento || null,
                data.sexo || null,
                data.raca_cor || null,
                data.nacionalidade || null,
                data.tipo_vinculo || null,
                data.banco,
                data.agencia,
                data.conta,
                data.tipo_conta,
                data.chave_pix,
                id
            ]);
        return data;
    },
    delete: async (id) => await run('DELETE FROM funcionarios WHERE id = ?', [id]),
    
    read: () => { throw new Error("Use async methods for funcionarios"); },
    write: () => { throw new Error("Use async methods for funcionarios"); }
};

const gestorEquipesRepo = {
    getEquipeByGestor: async (gestorUsername) => {
        return await all(
            `SELECT DISTINCT f.*
             FROM funcionarios f
             WHERE f.id IN (
                SELECT funcionario_id FROM gestor_equipes WHERE gestor_username = ?
             )
             OR UPPER(TRIM(COALESCE(f.setor, ''))) IN (
                SELECT UPPER(TRIM(COALESCE(setor, ''))) FROM gestor_setores WHERE gestor_username = ?
             )`,
            [gestorUsername, gestorUsername]
        );
    },
    addMembro: async (gestorUsername, funcionarioId) => {
        await run(
            `INSERT OR IGNORE INTO gestor_equipes (gestor_username, funcionario_id) VALUES (?, ?)`,
            [gestorUsername, funcionarioId]
        );
        return { gestorUsername, funcionarioId };
    },
    removeMembro: async (gestorUsername, funcionarioId) => {
        await run(
            `DELETE FROM gestor_equipes WHERE gestor_username = ? AND funcionario_id = ?`,
            [gestorUsername, funcionarioId]
        );
        return { gestorUsername, funcionarioId };
    },
    getGestoresByFuncionario: async (funcionarioId) => {
        return await all(
            `SELECT gestor_username FROM gestor_equipes WHERE funcionario_id = ?`,
            [funcionarioId]
        );
    }
};

const gestorSetoresRepo = {
    getSetoresByGestor: async (gestorUsername) => {
        const rows = await all(
            `SELECT setor FROM gestor_setores WHERE gestor_username = ? ORDER BY setor`,
            [gestorUsername]
        );
        return (rows || []).map(r => r && r.setor).filter(Boolean);
    },
    addSetor: async (gestorUsername, setor) => {
        await run(
            `INSERT OR IGNORE INTO gestor_setores (gestor_username, setor) VALUES (?, ?)`,
            [gestorUsername, setor]
        );
        return { gestorUsername, setor };
    },
    removeSetor: async (gestorUsername, setor) => {
        await run(
            `DELETE FROM gestor_setores WHERE gestor_username = ? AND setor = ?`,
            [gestorUsername, setor]
        );
        return { gestorUsername, setor };
    }
};

const taxasRepo = {
    getAll: async () => {
        const rows = await all('SELECT * FROM taxas');
        return rows.map(r => {
            const parsed = parseJsonFields(r, ['motivo', 'valores']);
            if (!parsed) return parsed;
            if (parsed.chave_pix && !parsed.pix) parsed.pix = parsed.chave_pix;
            if (parsed.pix && !parsed.chave_pix) parsed.chave_pix = parsed.pix;
            return parsed;
        });
    },
    getById: async (id) => {
        const row = await get('SELECT * FROM taxas WHERE id = ?', [id]);
        const parsed = parseJsonFields(row, ['motivo', 'valores']);
        if (!parsed) return parsed;
        if (parsed.chave_pix && !parsed.pix) parsed.pix = parsed.chave_pix;
        if (parsed.pix && !parsed.chave_pix) parsed.chave_pix = parsed.pix;
        return parsed;
    },
    create: async (data) => {
        const chavePix = data.chave_pix ?? data.pix ?? null;
        await run(`INSERT INTO taxas (id, nome_taxa, cpf, funcao, forma_pagamento, chave_pix, banco, agencia, conta, tipo_conta, departamento, motivo, detalhe_motivo, antecessor, valores, status, email_gestor, email_solicitante, approval_token, signature_token, assinatura, aprovador_nome, aprovador_username, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [data.id, data.nome_taxa, data.cpf, data.funcao, data.forma_pagamento, chavePix, data.banco, data.agencia, data.conta, data.tipo_conta, data.departamento, JSON.stringify(data.motivo), data.detalhe_motivo, data.antecessor, JSON.stringify(data.valores), data.status, data.email_gestor, data.email_solicitante, data.approvalToken || data.approval_token || null, data.signatureToken || data.signature_token || null, data.assinatura, data.aprovador_nome || null, data.aprovador_username || null, data.createdAt, data.updatedAt]);
        return data;
    },
    update: async (id, data) => {
        const chavePix = data.chave_pix ?? data.pix ?? null;
        await run(`UPDATE taxas SET nome_taxa=?, cpf=?, funcao=?, forma_pagamento=?, chave_pix=?, banco=?, agencia=?, conta=?, tipo_conta=?, departamento=?, motivo=?, detalhe_motivo=?, antecessor=?, valores=?, status=?, email_gestor=?, email_solicitante=?, approval_token=?, signature_token=?, assinatura=?, aprovador_nome=?, aprovador_username=?, updated_at=? WHERE id=?`,
            [data.nome_taxa, data.cpf, data.funcao, data.forma_pagamento, chavePix, data.banco, data.agencia, data.conta, data.tipo_conta, data.departamento, JSON.stringify(data.motivo), data.detalhe_motivo, data.antecessor, JSON.stringify(data.valores), data.status, data.email_gestor, data.email_solicitante, data.approvalToken || data.approval_token || null, data.signatureToken || data.signature_token || null, data.assinatura, data.aprovador_nome || null, data.aprovador_username || null, data.updatedAt, id]);
        return data;
    },
    read: () => { throw new Error("Use async methods for taxas"); },
    write: () => { throw new Error("Use async methods for taxas"); }
};

const rolePermissionsRepo = {
    getAll: async () => {
        const rows = await all('SELECT role, protected_paths, updated_at FROM role_permissions');
        return rows.map(r => parseJsonFields(r, ['protected_paths']));
    },
    getByRole: async (role) => {
        const row = await get('SELECT role, protected_paths, updated_at FROM role_permissions WHERE role = ?', [role]);
        return parseJsonFields(row, ['protected_paths']);
    },
    upsert: async ({ role, protected_paths }) => {
        const updatedAt = new Date().toISOString();
        await run(
            `INSERT OR REPLACE INTO role_permissions (role, protected_paths, updated_at) VALUES (?, ?, ?)`,
            [role, JSON.stringify(Array.isArray(protected_paths) ? protected_paths : []), updatedAt]
        );
        return { role, protected_paths, updated_at: updatedAt };
    }
};

// ... Add similar for vagas and candidatos if needed, but for now focusing on main entities ...

module.exports = {
    ping,
    admin: {
        purgeTestData
    },
    solicitacoes: solicitacoesRepo,
    funcionarios: funcionariosRepo,
    gestorEquipes: gestorEquipesRepo,
    gestorSetores: gestorSetoresRepo,
    taxas: taxasRepo,
    rolePermissions: rolePermissionsRepo,
    solicitacoesTaxa: {
        getAll: async () => {
            return await all('SELECT * FROM solicitacoes_taxa');
        },
        getById: async (id) => {
            return await get('SELECT * FROM solicitacoes_taxa WHERE id = ?', [id]);
        },
        create: async (data) => {
            await run(`INSERT INTO solicitacoes_taxa (id, solicitante, email_solicitante, departamento, funcao_necessaria, motivo, detalhe_motivo, data_necessaria, horario_inicio, horario_fim, quantidade_vagas, observacoes, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                [data.id, data.solicitante, data.email_solicitante, data.departamento, data.funcao_necessaria, data.motivo, data.detalhe_motivo, data.data_necessaria, data.horario_inicio, data.horario_fim, data.quantidade_vagas, data.observacoes, data.status, data.created_at, data.updated_at]);
            return data;
        },
        update: async (id, data) => {
            await run(`UPDATE solicitacoes_taxa SET solicitante=?, email_solicitante=?, departamento=?, funcao_necessaria=?, motivo=?, detalhe_motivo=?, data_necessaria=?, horario_inicio=?, horario_fim=?, quantidade_vagas=?, observacoes=?, status=?, updated_at=? WHERE id=?`,
                [data.solicitante, data.email_solicitante, data.departamento, data.funcao_necessaria, data.motivo, data.detalhe_motivo, data.data_necessaria, data.horario_inicio, data.horario_fim, data.quantidade_vagas, data.observacoes, data.status, data.updatedAt || new Date().toISOString(), id]);
            return data;
        }
    },
    // Hybrid: Keep using JSON for these until migrated
    vagas: { // Migrated in schema, but let's stick to JSON for a second or migrate fully?
             // init.js migrated them. Let's do it.
        getAll: async () => {
            const rows = await all('SELECT * FROM vagas');
            return rows.map(r => {
                const dados = r.dados ? JSON.parse(r.dados) : {};
                return {
                    ...dados,
                    ...r,
                    createdAt: r.created_at,
                    updatedAt: r.updated_at,
                    ativa: !!r.ativa, // Ensure boolean
                    dados: undefined
                };
            });
        },
        getById: async (id) => {
            const r = await get('SELECT * FROM vagas WHERE id = ?', [id]);
            if (!r) return null;
            const dados = r.dados ? JSON.parse(r.dados) : {};
            return {
                ...dados,
                ...r,
                createdAt: r.created_at,
                updatedAt: r.updated_at,
                ativa: !!r.ativa,
                dados: undefined
            };
        },
        create: async (data) => {
             const titulo = data.titulo || data.cargo;
             const departamento = data.departamento || data.setor;
             const { id, titulo: t, descricao, requisitos, status, ativa, createdAt, departamento: d, ...rest } = data;
             
             await run(`INSERT INTO vagas (id, titulo, descricao, requisitos, status, ativa, created_at, departamento, dados) VALUES (?,?,?,?,?,?,?,?,?)`,
                [data.id, titulo, data.descricao, data.requisitos, data.status, data.ativa ? 1 : 0, data.createdAt, departamento, JSON.stringify(rest)]);
             return data;
        },
        update: async (id, data) => {
            const titulo = data.titulo || data.cargo;
            const departamento = data.departamento || data.setor;
            const { id: _, titulo: t, descricao, requisitos, status, ativa, createdAt, departamento: d, ...rest } = data;
            
            // If we want to preserve existing dados fields not in 'rest', we should fetch first?
            // But usually 'data' is the full object in our app logic.
            // Let's assume 'rest' contains all extra fields we want to save.
            
            await run(`UPDATE vagas SET titulo=?, descricao=?, requisitos=?, status=?, ativa=?, departamento=?, dados=? WHERE id=?`,
                [titulo, data.descricao, data.requisitos, data.status, data.ativa ? 1 : 0, departamento, JSON.stringify(rest), id]);
            return data;
        },
        delete: async (id) => {
            await run('DELETE FROM vagas WHERE id = ?', [id]);
            return { id };
        },
        read: () => { throw new Error("Use async methods for vagas"); },
        write: () => { throw new Error("Use async methods for vagas"); }
    },
    candidatos: {
        getAll: async () => {
            const rows = await all('SELECT * FROM candidatos');
            return rows.map(r => {
                const base = parseJsonFields(r, ['historico']);
                const dados = r.dados ? JSON.parse(r.dados) : {};
                return { ...dados, ...base, dados: undefined };
            });
        },
        getById: async (id) => {
            const row = await get('SELECT * FROM candidatos WHERE id = ?', [id]);
            if (!row) return null;
            const base = parseJsonFields(row, ['historico']);
            const dados = row.dados ? JSON.parse(row.dados) : {};
            return { ...dados, ...base, dados: undefined };
        },
        create: async (data) => {
            const { id, nome, email, telefone, curriculo, status, observacao, data_entrevista, local_entrevista, entrevistador, createdAt, historico, ...rest } = data;
            await run(`INSERT INTO candidatos (id, nome, email, telefone, curriculo, status, observacao, data_entrevista, local_entrevista, entrevistador, created_at, historico, dados) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                [id, nome, email, telefone, curriculo, status, observacao, data_entrevista, local_entrevista, entrevistador, createdAt, JSON.stringify(historico), JSON.stringify(rest)]);
            return data;
        },
        update: async (id, data) => {
            const { nome, email, telefone, curriculo, status, observacao, data_entrevista, local_entrevista, entrevistador, historico, ...rest } = data;
            
            // Need to merge rest with existing dados to avoid overwriting with partial data if update is partial?
            // Usually update receives full object or we fetch first.
            // But let's assume 'data' might be the full object or we overwrite dados with whatever is in rest.
            // Safer to fetch current if we want partial updates, but here let's assume we pass what we want to save.
            // Actually, in routes/candidatos.js update status only passes status/obs. 
            // So we should be careful. 
            // But wait, the route code does: candidato = await getById(id); candidato.status = ...; await update(id, candidato);
            // So it passes the FULL object.
            
            // However, the object passed to update will now contain flattened fields from 'dados' (because getById merged them).
            // So we need to separate them again.
            
            await run(`UPDATE candidatos SET nome=?, email=?, telefone=?, curriculo=?, status=?, observacao=?, data_entrevista=?, local_entrevista=?, entrevistador=?, historico=?, dados=? WHERE id=?`,
                [nome, email, telefone, curriculo, status, observacao, data_entrevista, local_entrevista, entrevistador, JSON.stringify(historico), JSON.stringify(rest), id]);
            return data;
        },
        delete: async (id) => {
            await run('DELETE FROM candidatos WHERE id = ?', [id]);
            return { id };
        },
        read: () => { throw new Error("Use async methods for candidatos"); },
        write: () => { throw new Error("Use async methods for candidatos"); }
    },
    formularios: {
        getAll: async () => {
            const rows = await all('SELECT * FROM formularios');
            return rows.map(r => {
                const parsed = parseJsonFields(r, ['questoes']);
                const dashboardId = parsed.dashboard_id || parsed.dashboardId || parsed.id;
                return { ...parsed, dashboardId, questoes: normalizeFormularioQuestoes(parsed.questoes) };
            });
        },
        getById: async (id) => {
            const row = await get('SELECT * FROM formularios WHERE id = ?', [id]);
            const parsed = parseJsonFields(row, ['questoes']);
            if (!parsed) return parsed;
            const dashboardId = parsed.dashboard_id || parsed.dashboardId || parsed.id;
            return { ...parsed, dashboardId, questoes: normalizeFormularioQuestoes(parsed.questoes) };
        },
        getByDashboardId: async (dashboardId) => {
            const rows = await all('SELECT * FROM formularios WHERE dashboard_id = ? ORDER BY created_at DESC', [dashboardId]);
            return rows.map(r => {
                const parsed = parseJsonFields(r, ['questoes']);
                const dash = parsed.dashboard_id || parsed.dashboardId || parsed.id;
                return { ...parsed, dashboardId: dash, questoes: normalizeFormularioQuestoes(parsed.questoes) };
            });
        },
        create: async (data) => {
            const questoes = normalizeFormularioQuestoes(data.questoes);
            const dashboardId = data.dashboardId || data.dashboard_id || data.id;
            await run(`INSERT INTO formularios (id, titulo, tipo, questoes, ativo, created_at, updated_at, dashboard_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [data.id, data.titulo, data.tipo, JSON.stringify(questoes), data.ativo ? 1 : 0, data.createdAt || new Date().toISOString(), data.updatedAt || new Date().toISOString(), dashboardId]);
            return data;
        },
        update: async (id, data) => {
            const questoes = normalizeFormularioQuestoes(data.questoes);
            const dashboardId = data.dashboardId || data.dashboard_id || id;
            await run(`UPDATE formularios SET titulo=?, tipo=?, questoes=?, ativo=?, updated_at=?, dashboard_id=? WHERE id=?`,
                [data.titulo, data.tipo, JSON.stringify(questoes), data.ativo ? 1 : 0, data.updatedAt || new Date().toISOString(), dashboardId, id]);
            return data;
        },
        delete: async (id) => {
            await run('BEGIN TRANSACTION');
            try {
                await run('DELETE FROM respostas_formularios WHERE formulario_id = ?', [id]);
                await run('DELETE FROM formularios WHERE id = ?', [id]);
                await run('COMMIT');
            } catch (e) {
                try { await run('ROLLBACK'); } catch (_) {}
                throw e;
            }
        }
    },
    dashboardsFormularios: {
        getAll: async () => {
            const rows = await all(`
                SELECT d.*,
                    (SELECT COUNT(*) FROM formularios f WHERE f.dashboard_id = d.id) AS forms_count,
                    (SELECT COUNT(*) FROM respostas_formularios r JOIN formularios f ON f.id = r.formulario_id WHERE f.dashboard_id = d.id) AS respostas_count
                FROM formularios_dashboards d
                ORDER BY d.updated_at DESC
            `);
            return rows;
        },
        getById: async (id) => {
            const row = await get('SELECT * FROM formularios_dashboards WHERE id = ?', [id]);
            return row || null;
        },
        create: async (data) => {
            const createdAt = data.createdAt || new Date().toISOString();
            const updatedAt = data.updatedAt || new Date().toISOString();
            await run(
                `INSERT OR IGNORE INTO formularios_dashboards (id, titulo, tipo, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
                [data.id, data.titulo || null, data.tipo || null, createdAt, updatedAt]
            );
            await run(
                `UPDATE formularios_dashboards SET titulo = COALESCE(?, titulo), tipo = COALESCE(?, tipo), updated_at = ? WHERE id = ?`,
                [data.titulo || null, data.tipo || null, updatedAt, data.id]
            );
            return data;
        },
        touch: async (id) => {
            await run(`UPDATE formularios_dashboards SET updated_at = ? WHERE id = ?`, [new Date().toISOString(), id]);
        }
    },
    respostas: {
        getAll: async () => {
            const rows = await all('SELECT * FROM respostas_formularios');
            return rows.map(r => parseJsonFields(r, ['respostas']));
        },
        getByFormId: async (formId) => {
            const rows = await all('SELECT * FROM respostas_formularios WHERE formulario_id = ?', [formId]);
            return rows.map(r => parseJsonFields(r, ['respostas']));
        },
        getByDashboardId: async (dashboardId) => {
            const rows = await all(`
                SELECT r.*, f.titulo AS formulario_titulo, f.id AS formulario_id
                FROM respostas_formularios r
                JOIN formularios f ON f.id = r.formulario_id
                WHERE f.dashboard_id = ?
                ORDER BY r.created_at DESC
            `, [dashboardId]);
            return rows.map(r => parseJsonFields(r, ['respostas']));
        },
        create: async (data) => {
            await run(`INSERT INTO respostas_formularios (id, formulario_id, funcionario_id, respostas, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
                [data.id, data.formulario_id, data.funcionario_id, JSON.stringify(data.respostas), data.createdAt || new Date().toISOString(), data.updatedAt || new Date().toISOString()]);
            return data;
        }
    },
    users: {
        getAll: async () => await all('SELECT id, username, role, name, email, created_at FROM users'),
        getByUsername: async (username) => await get('SELECT * FROM users WHERE username = ?', [username]),
        create: async (data) => {
            await run(`INSERT INTO users (username, password, role, name, email, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
                [data.username, data.password, data.role, data.name, data.email || null, new Date().toISOString()]);
            return data;
        },
        update: async (username, data) => {
            const fields = [];
            const params = [];
            if (data.password) {
                fields.push('password = ?');
                params.push(data.password);
            }
            if (data.role) {
                fields.push('role = ?');
                params.push(data.role);
            }
            if (data.name) {
                fields.push('name = ?');
                params.push(data.name);
            }
            if (Object.prototype.hasOwnProperty.call(data, 'email')) {
                fields.push('email = ?');
                params.push(data.email || null);
            }
            
            if (fields.length === 0) return null;
            
            params.push(username);
            await run(`UPDATE users SET ${fields.join(', ')} WHERE username = ?`, params);
            return data;
        },
        delete: async (username) => await run('DELETE FROM users WHERE username = ?', [username])
    },
    // Remaining JSON entities
    epis: {
        getAll: async () => await all('SELECT * FROM epis'),
        getById: async (id) => await get('SELECT * FROM epis WHERE id = ?', [id]),
        create: async (data) => {
            await run(`INSERT INTO epis (id, nome, valor, estoque, possui_ca, ca_validade, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [data.id, data.nome, data.valor, data.estoque, data.possui_ca ? 1 : 0, data.ca_validade, data.createdAt, data.updatedAt]);
            return data;
        },
        update: async (id, data) => {
             await run(`UPDATE epis SET nome=?, valor=?, estoque=?, possui_ca=?, ca_validade=?, updated_at=? WHERE id=?`,
                [data.nome, data.valor, data.estoque, data.possui_ca ? 1 : 0, data.ca_validade, data.updatedAt, id]);
             return data;
        },
        delete: async (id) => await run('DELETE FROM epis WHERE id = ?', [id]),
        read: () => { throw new Error("Use async methods for epis"); },
        write: () => { throw new Error("Use async methods for epis"); }
    },
    solicitacoesEpis: {
        getAll: async () => {
            const rows = await all('SELECT * FROM solicitacoes_epis ORDER BY created_at DESC');
            return rows.map(r => parseJsonFields(r, ['itens_solicitados']));
        },
        getById: async (id) => {
            const row = await get('SELECT * FROM solicitacoes_epis WHERE id = ?', [id]);
            return parseJsonFields(row, ['itens_solicitados']);
        },
        create: async (data) => {
            await run(
                `INSERT INTO solicitacoes_epis (id, funcionario_id, tipo, itens_solicitados, status, atendido_at, atendido_por, assinatura, assinatura_tipo, assinatura_at, assinatura_por, evidencia_foto, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    data.id,
                    data.funcionario_id,
                    data.tipo || 'retirada',
                    JSON.stringify(Array.isArray(data.itens_solicitados) ? data.itens_solicitados : []),
                    data.status || 'pendente',
                    data.atendido_at || null,
                    data.atendido_por || null,
                    data.assinatura || null,
                    data.assinatura_tipo || null,
                    data.assinatura_at || null,
                    data.assinatura_por || null,
                    data.evidencia_foto || null,
                    data.createdAt,
                    data.updatedAt
                ]
            );
            return data;
        },
        updateStatus: async (id, data) => {
            await run(
                `UPDATE solicitacoes_epis SET status=?, atendido_at=?, atendido_por=?, assinatura=?, assinatura_tipo=?, assinatura_at=?, assinatura_por=?, evidencia_foto=?, updated_at=? WHERE id=?`,
                [
                    data.status,
                    data.atendido_at || null,
                    data.atendido_por || null,
                    data.assinatura || null,
                    data.assinatura_tipo || null,
                    data.assinatura_at || null,
                    data.assinatura_por || null,
                    data.evidencia_foto || null,
                    data.updatedAt,
                    id
                ]
            );
            return data;
        },
        read: () => { throw new Error("Use async methods for solicitacoesEpis"); },
        write: () => { throw new Error("Use async methods for solicitacoesEpis"); }
    },
    movimentacoesEpis: {
        getAll: async () => {
            const rows = await all('SELECT * FROM movimentacoes_epis');
            return rows.map(r => parseJsonFields(r, ['itens_retirados', 'itens_devolvidos']));
        },
        create: async (data) => {
            await run(`INSERT INTO movimentacoes_epis (id, funcionario_id, itens_retirados, itens_devolvidos, evidencia, tipo_evidencia, termo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [data.id, data.funcionario_id, JSON.stringify(data.itens_retirados), JSON.stringify(data.itens_devolvidos), data.evidencia, data.tipo_evidencia, data.termo || null, data.createdAt]);
            return data;
        },
        read: () => { throw new Error("Use async methods for movimentacoesEpis"); },
        write: () => { throw new Error("Use async methods for movimentacoesEpis"); }
    },
    descontosEpis: {
        getAll: async () => {
             const rows = await all('SELECT * FROM descontos_epis');
             return rows.map(r => parseJsonFields(r, ['itens']));
        },
        getById: async (id) => {
             const row = await get('SELECT * FROM descontos_epis WHERE id = ?', [id]);
             return parseJsonFields(row, ['itens']);
        },
        create: async (data) => {
            await run(`INSERT INTO descontos_epis (id, nome_funcionario, cpf_funcionario, itens, parcelas, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [data.id, data.nome_funcionario, data.cpf_funcionario, JSON.stringify(data.itens), data.parcelas, data.status, data.createdAt, data.updatedAt]);
            return data;
        },
        update: async (id, data) => {
            await run(`UPDATE descontos_epis SET status=?, updated_at=? WHERE id=?`,
                [data.status, data.updatedAt, id]);
            return data;
        },
        read: () => { throw new Error("Use async methods for descontosEpis"); },
        write: () => { throw new Error("Use async methods for descontosEpis"); }
    },
    entrevistasDesligamento: {
        getAll: async () => {
             const rows = await all('SELECT * FROM entrevistas_desligamento');
             return rows.map(r => {
                 const dados = r.dados ? JSON.parse(r.dados) : {};
                 return { ...dados, ...r, dados: undefined };
             });
        },
        getById: async (id) => {
             const row = await get('SELECT * FROM entrevistas_desligamento WHERE id = ?', [id]);
             if (!row) return null;
             const dados = row.dados ? JSON.parse(row.dados) : {};
             return { ...dados, ...row, dados: undefined };
        },
        create: async (data) => {
            const { id, nome, setor, createdAt, ...rest } = data;
            await run(`INSERT INTO entrevistas_desligamento (id, nome, setor, dados, created_at) VALUES (?, ?, ?, ?, ?)`,
                [id, nome, setor, JSON.stringify(rest), createdAt]);
            return data;
        },
        read: () => { throw new Error("Use async methods for entrevistasDesligamento"); },
        write: () => { throw new Error("Use async methods for entrevistasDesligamento"); }
    },
    recrutamentoInterno: {
        getAll: async () => {
             const rows = await all('SELECT * FROM recrutamento_interno');
             return rows.map(r => {
                 const dados = r.dados ? JSON.parse(r.dados) : {};
                 return { ...dados, ...r, dados: undefined };
             });
        },
        getById: async (id) => {
             const row = await get('SELECT * FROM recrutamento_interno WHERE id = ?', [id]);
             if (!row) return null;
             const dados = row.dados ? JSON.parse(row.dados) : {};
             return { ...dados, ...row, dados: undefined };
        },
        create: async (data) => {
            const { id, nome, cargoPretendido, setor, status, observacao_rh, createdAt, updatedAt, ...rest } = data;
            // Ensure compatibility with both schema versions (some might use cargo_pretendido vs cargoPretendido)
            const cargo_pretendido = cargoPretendido || rest.cargo_pretendido;
            
            await run(`INSERT INTO recrutamento_interno (id, nome, cargo_pretendido, setor, status, observacao_rh, dados, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, nome, cargo_pretendido, setor, status, observacao_rh, JSON.stringify(rest), createdAt, updatedAt]);
            return data;
        },
        update: async (id, data) => {
             const current = await get('SELECT * FROM recrutamento_interno WHERE id = ?', [id]);
             if (!current) return null;
             const currentDados = current.dados ? JSON.parse(current.dados) : {};
             
             const { status, observacao_rh, updatedAt, ...rest } = data;
             const newDados = { ...currentDados, ...rest };
             
             await run(`UPDATE recrutamento_interno SET status=?, observacao_rh=?, dados=?, updated_at=? WHERE id=?`,
                [status, observacao_rh, JSON.stringify(newDados), updatedAt, id]);
             return data;
        },
        read: () => { throw new Error("Use async methods for recrutamentoInterno"); },
        write: () => { throw new Error("Use async methods for recrutamentoInterno"); }
    },
    movimentacoes: {
        getAll: async () => {
            const rows = await all('SELECT * FROM movimentacoes');
            return rows.map(r => {
                const dados = r.dados ? JSON.parse(r.dados) : {};
                return { ...dados, ...r, dados: undefined }; 
            });
        },
        getById: async (id) => {
            const row = await get('SELECT * FROM movimentacoes WHERE id = ?', [id]);
            if (!row) return null;
            const dados = row.dados ? JSON.parse(row.dados) : {};
            return { ...dados, ...row, dados: undefined };
        },
        create: async (data) => {
            const { id, nome_colaborador, setor, cargo, status, createdAt, updatedAt, ...rest } = data;
            await run(`INSERT INTO movimentacoes (id, nome_colaborador, setor, cargo, status, dados, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, nome_colaborador, setor, cargo, status, JSON.stringify(rest), createdAt, updatedAt]);
            return data;
        },
        update: async (id, data) => {
             const current = await get('SELECT * FROM movimentacoes WHERE id = ?', [id]);
             if (!current) return null;
             
             const currentDados = current.dados ? JSON.parse(current.dados) : {};
             const { nome_colaborador, setor, cargo, status, updatedAt, ...rest } = data;
             
             const newNome = nome_colaborador !== undefined ? nome_colaborador : current.nome_colaborador;
             const newSetor = setor !== undefined ? setor : current.setor;
             const newCargo = cargo !== undefined ? cargo : current.cargo;
             const newStatus = status !== undefined ? status : current.status;
             const newUpdatedAt = updatedAt || new Date().toISOString();
             
             const newDados = { ...currentDados, ...rest };
             
             await run(`UPDATE movimentacoes SET nome_colaborador=?, setor=?, cargo=?, status=?, dados=?, updated_at=? WHERE id=?`,
                [newNome, newSetor, newCargo, newStatus, JSON.stringify(newDados), newUpdatedAt, id]);
             
             return { ...data, id };
        },
        read: () => { throw new Error("Use async methods for movimentacoes"); },
        write: () => { throw new Error("Use async methods for movimentacoes"); }
    },
    onthejob: {
        getAll: async () => {
             const rows = await all('SELECT * FROM onthejob');
             return rows.map(r => {
                 const dados = r.dados ? JSON.parse(r.dados) : {};
                 return { ...dados, ...r, dados: undefined };
             });
        },
        getById: async (id) => {
             const row = await get('SELECT * FROM onthejob WHERE id = ?', [id]);
             if (!row) return null;
             const dados = row.dados ? JSON.parse(row.dados) : {};
             return { ...dados, ...row, dados: undefined };
        },
        create: async (data) => {
            const { id, colaboradorNome, empresa, status, createdAt, ...rest } = data;
            await run(`INSERT INTO onthejob (id, nome_colaborador, empresa, status, dados, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
                [id, colaboradorNome, empresa, status, JSON.stringify(rest), createdAt]);
            return data;
        },
        update: async (id, data) => {
             const current = await get('SELECT * FROM onthejob WHERE id = ?', [id]);
             if (!current) return null;
             const currentDados = current.dados ? JSON.parse(current.dados) : {};
             
             const { status, updatedAt, ...rest } = data;
             const newDados = { ...currentDados, ...rest };
             
             await run(`UPDATE onthejob SET status=?, dados=? WHERE id=?`,
                [status, JSON.stringify(newDados), id]);
             return data;
        },
        read: () => { throw new Error("Use async methods for onthejob"); },
        write: () => { throw new Error("Use async methods for onthejob"); }
    },
    disciplinar: {
        getAll: async () => {
            const rows = await all('SELECT * FROM disciplinar_registros');
            return rows.map(r => {
                const dados = r.dados ? JSON.parse(r.dados) : {};
                return {
                    ...dados,
                    id: r.id,
                    funcionarioId: r.funcionario_id,
                    tipo: r.tipo,
                    createdAt: r.created_at,
                    updatedAt: r.updated_at
                };
            });
        },
        getById: async (id) => {
            const row = await get('SELECT * FROM disciplinar_registros WHERE id = ?', [id]);
            if (!row) return null;
            const dados = row.dados ? JSON.parse(row.dados) : {};
            return {
                ...dados,
                id: row.id,
                funcionarioId: row.funcionario_id,
                tipo: row.tipo,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            };
        },
        create: async (data) => {
            const {
                id,
                funcionarioId,
                tipo,
                createdAt,
                updatedAt,
                ...rest
            } = data;
            await run(
                'INSERT INTO disciplinar_registros (id, funcionario_id, tipo, dados, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
                [id, funcionarioId, tipo, JSON.stringify(rest), createdAt, updatedAt]
            );
            return data;
        },
        update: async (id, data) => {
            const current = await get('SELECT * FROM disciplinar_registros WHERE id = ?', [id]);
            if (!current) return null;
            const currentDados = current.dados ? JSON.parse(current.dados) : {};

            const {
                funcionarioId,
                tipo,
                updatedAt,
                ...rest
            } = data;

            const newFuncionarioId = funcionarioId !== undefined ? funcionarioId : current.funcionario_id;
            const newTipo = tipo !== undefined ? tipo : current.tipo;
            const newUpdatedAt = updatedAt || new Date().toISOString();
            const newDados = { ...currentDados, ...rest };

            await run(
                'UPDATE disciplinar_registros SET funcionario_id=?, tipo=?, dados=?, updated_at=? WHERE id=?',
                [newFuncionarioId, newTipo, JSON.stringify(newDados), newUpdatedAt, id]
            );
            return { ...data, id };
        },
        remove: async (id) => {
            await run('DELETE FROM disciplinar_registros WHERE id = ?', [id]);
            return { ok: true };
        },
        read: () => { throw new Error("Use async methods for disciplinar"); },
        write: () => { throw new Error("Use async methods for disciplinar"); }
    },
    avaliacoes: {
        getAll: async () => {
             const rows = await all('SELECT * FROM avaliacoes');
             return rows.map(r => {
                 const dados = r.dados ? JSON.parse(r.dados) : {};
                 return { ...dados, ...r, dados: undefined };
             });
        },
        getById: async (id) => {
             const row = await get('SELECT * FROM avaliacoes WHERE id = ?', [id]);
             if (!row) return null;
             const dados = row.dados ? JSON.parse(row.dados) : {};
             return { ...dados, ...row, dados: undefined };
        },
        create: async (data) => {
            const { id, tipo, funcionario, avaliador, createdAt, ...rest } = data;
            await run(`INSERT INTO avaliacoes (id, tipo, funcionario, avaliador, dados, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
                [id, tipo, funcionario, avaliador, JSON.stringify(rest), createdAt]);
            return data;
        },
        update: async (id, data) => {
             const current = await get('SELECT * FROM avaliacoes WHERE id = ?', [id]);
             if (!current) return null;
             const currentDados = current.dados ? JSON.parse(current.dados) : {};
             
             // Extract explicit columns if we want to update them, but usually they are fixed.
             // Assume 'tipo', 'funcionario', 'avaliador' might change? probably not.
             // Just update 'dados'.
             
             const { id: _, tipo, funcionario, avaliador, created_at, ...rest } = data;
             const newDados = { ...currentDados, ...rest };
             
             await run(`UPDATE avaliacoes SET dados=? WHERE id=?`,
                [JSON.stringify(newDados), id]);
             return { ...data, id };
        },
        read: () => { throw new Error("Use async methods for avaliacoes"); },
        write: () => { throw new Error("Use async methods for avaliacoes"); }
    },
    acessos: {
        getAll: async () => await all('SELECT rowid as id, * FROM acessos ORDER BY entrada DESC'),
        create: async (data) => {
            await run(`INSERT INTO acessos (tipo, nome, empresa, documento, placa, entrada, saida) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [data.tipo, data.nome, data.empresa, data.documento, data.placa, data.entrada, data.saida]);
            return data;
        },
        update: async (id, data) => {
            await run(`UPDATE acessos SET saida=? WHERE rowid=?`, [data.saida, id]);
            return data;
        },
        read: () => { throw new Error("Use async methods for acessos"); },
        write: () => { throw new Error("Use async methods for acessos"); }
    },
    uniformes: {
        getAll: async () => {
             const rows = await all('SELECT * FROM uniformes');
             return rows.map(r => parseJsonFields(r, ['itens']));
        },
        getById: async (id) => {
             const row = await get('SELECT * FROM uniformes WHERE id = ?', [id]);
             return parseJsonFields(row, ['itens']);
        },
        create: async (data) => {
            await run(`INSERT INTO uniformes (id, nome, itens, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
                [data.id, data.nome, JSON.stringify(data.itens), data.status, data.createdAt, data.updatedAt]);
            return data;
        },
        update: async (id, data) => {
             await run(`UPDATE uniformes SET status=?, updated_at=? WHERE id=?`,
                [data.status, data.updatedAt, id]);
             return data;
        },
        read: () => { throw new Error("Use async methods for uniformes"); },
        write: () => { throw new Error("Use async methods for uniformes"); }
    }
};
