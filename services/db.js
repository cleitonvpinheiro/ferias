const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, '..', 'database', 'formularios.db');

// --- SQLite Helpers ---
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) console.error('Erro ao conectar ao SQLite:', err.message);
    else console.log('Conectado ao banco de dados SQLite.');
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

const purgeTestData = async ({ preserveFuncionarios = true } = {}) => {
    const tablesToClear = [
        'historico_solicitacoes',
        'solicitacoes_ferias',
        'taxas',
        'candidatos',
        'vagas',
        'movimentacoes_epis',
        'descontos_epis',
        'movimentacoes',
        'epis',
        'entrevistas_desligamento',
        'recrutamento_interno',
        'onthejob',
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
        
        await run(`INSERT INTO solicitacoes_ferias (
            id, nome, setor, inicio, inicio2, tipo_gozo, decimo, gestor_email, nome_gestor, 
            status, status_rh, sugestao_data, justificativa, assinatura, signature_token, signed_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            id, nome, setor, inicio, inicio2, tipoGozo, decimo, gestorEmail, nomeGestor,
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

        await run(`UPDATE solicitacoes_ferias SET 
            nome=?, setor=?, inicio=?, inicio2=?, tipo_gozo=?, decimo=?, gestor_email=?, nome_gestor=?, 
            status=?, status_rh=?, sugestao_data=?, justificativa=?, assinatura=?, signature_token=?, signed_at=?, updated_at=?
            WHERE id=?`, [
            nome, setor, inicio, inicio2, tipoGozo, decimo, gestorEmail, nomeGestor,
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
        await run(`INSERT INTO funcionarios (id, nome, cpf, matricula, cargo, setor, banco, agencia, conta, tipo_conta, chave_pix) VALUES (?,?,?,?,?,?,?,?,?,?,?)`, 
            [data.id, data.nome, data.cpf, data.matricula, data.cargo, data.setor, data.banco, data.agencia, data.conta, data.tipo_conta, data.chave_pix]);
        return data;
    },
    update: async (id, data) => {
        await run(`UPDATE funcionarios SET nome=?, cpf=?, matricula=?, cargo=?, setor=?, banco=?, agencia=?, conta=?, tipo_conta=?, chave_pix=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`, 
            [data.nome, data.cpf, data.matricula, data.cargo, data.setor, data.banco, data.agencia, data.conta, data.tipo_conta, data.chave_pix, id]);
        return data;
    },
    delete: async (id) => await run('DELETE FROM funcionarios WHERE id = ?', [id]),
    
    read: () => { throw new Error("Use async methods for funcionarios"); },
    write: () => { throw new Error("Use async methods for funcionarios"); }
};

const taxasRepo = {
    getAll: async () => {
        const rows = await all('SELECT * FROM taxas');
        return rows.map(r => parseJsonFields(r, ['motivo', 'valores']));
    },
    getById: async (id) => {
        const row = await get('SELECT * FROM taxas WHERE id = ?', [id]);
        return parseJsonFields(row, ['motivo', 'valores']);
    },
    create: async (data) => {
        await run(`INSERT INTO taxas (id, nome_taxa, cpf, funcao, forma_pagamento, chave_pix, banco, agencia, conta, tipo_conta, departamento, motivo, detalhe_motivo, antecessor, valores, status, email_gestor, email_solicitante, signature_token, assinatura, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [data.id, data.nome_taxa, data.cpf, data.funcao, data.forma_pagamento, data.chave_pix, data.banco, data.agencia, data.conta, data.tipo_conta, data.departamento, JSON.stringify(data.motivo), data.detalhe_motivo, data.antecessor, JSON.stringify(data.valores), data.status, data.email_gestor, data.email_solicitante, data.signatureToken, data.assinatura, data.createdAt, data.updatedAt]);
        return data;
    },
    update: async (id, data) => {
        await run(`UPDATE taxas SET nome_taxa=?, cpf=?, funcao=?, forma_pagamento=?, chave_pix=?, banco=?, agencia=?, conta=?, tipo_conta=?, departamento=?, motivo=?, detalhe_motivo=?, antecessor=?, valores=?, status=?, email_gestor=?, email_solicitante=?, signature_token=?, assinatura=?, updated_at=? WHERE id=?`,
            [data.nome_taxa, data.cpf, data.funcao, data.forma_pagamento, data.chave_pix, data.banco, data.agencia, data.conta, data.tipo_conta, data.departamento, JSON.stringify(data.motivo), data.detalhe_motivo, data.antecessor, JSON.stringify(data.valores), data.status, data.email_gestor, data.email_solicitante, data.signatureToken, data.assinatura, data.updatedAt, id]);
        return data;
    },
    read: () => { throw new Error("Use async methods for taxas"); },
    write: () => { throw new Error("Use async methods for taxas"); }
};

// ... Add similar for vagas and candidatos if needed, but for now focusing on main entities ...

module.exports = {
    admin: {
        purgeTestData
    },
    solicitacoes: solicitacoesRepo,
    funcionarios: funcionariosRepo,
    taxas: taxasRepo,
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
        read: () => { throw new Error("Use async methods for candidatos"); },
        write: () => { throw new Error("Use async methods for candidatos"); }
    },
    formularios: {
        getAll: async () => {
            const rows = await all('SELECT * FROM formularios');
            return rows.map(r => parseJsonFields(r, ['questoes']));
        },
        getById: async (id) => {
            const row = await get('SELECT * FROM formularios WHERE id = ?', [id]);
            return parseJsonFields(row, ['questoes']);
        },
        create: async (data) => {
            await run(`INSERT INTO formularios (id, titulo, tipo, questoes, ativo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [data.id, data.titulo, data.tipo, JSON.stringify(data.questoes), data.ativo ? 1 : 0, data.createdAt || new Date().toISOString(), data.updatedAt || new Date().toISOString()]);
            return data;
        },
        update: async (id, data) => {
            await run(`UPDATE formularios SET titulo=?, tipo=?, questoes=?, ativo=?, updated_at=? WHERE id=?`,
                [data.titulo, data.tipo, JSON.stringify(data.questoes), data.ativo ? 1 : 0, data.updatedAt || new Date().toISOString(), id]);
            return data;
        },
        delete: async (id) => await run('DELETE FROM formularios WHERE id = ?', [id])
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
        create: async (data) => {
            await run(`INSERT INTO respostas_formularios (id, formulario_id, funcionario_id, respostas, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
                [data.id, data.formulario_id, data.funcionario_id, JSON.stringify(data.respostas), data.createdAt || new Date().toISOString(), data.updatedAt || new Date().toISOString()]);
            return data;
        }
    },
    users: {
        getAll: async () => await all('SELECT id, username, role, name, created_at FROM users'),
        getByUsername: async (username) => await get('SELECT * FROM users WHERE username = ?', [username]),
        create: async (data) => {
            await run(`INSERT INTO users (username, password, role, name, created_at) VALUES (?, ?, ?, ?, ?)`,
                [data.username, data.password, data.role, data.name, new Date().toISOString()]);
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
            await run(`INSERT INTO epis (id, nome, valor, estoque, ca_validade, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [data.id, data.nome, data.valor, data.estoque, data.ca_validade, data.createdAt, data.updatedAt]);
            return data;
        },
        update: async (id, data) => {
             await run(`UPDATE epis SET nome=?, valor=?, estoque=?, ca_validade=?, updated_at=? WHERE id=?`,
                [data.nome, data.valor, data.estoque, data.ca_validade, data.updatedAt, id]);
             return data;
        },
        delete: async (id) => await run('DELETE FROM epis WHERE id = ?', [id]),
        read: () => { throw new Error("Use async methods for epis"); },
        write: () => { throw new Error("Use async methods for epis"); }
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
