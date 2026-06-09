const crypto = require('crypto');
const db = require('../../../services/db');

function normalizeDoc(input) {
    const raw = String(input || '').trim();
    const digits = raw.replace(/\D/g, '');
    return { raw, digits };
}

async function findColaboradorByDoc(doc) {
    const { raw, digits } = normalizeDoc(doc);
    if (!raw && !digits) return null;

    let row = await db.sql.get(
        'SELECT * FROM funcionarios WHERE cpf = ? OR matricula = ? LIMIT 1',
        [raw, raw]
    );
    if (row) return row;

    if (!digits) return null;
    row = await db.sql.get(
        `SELECT * FROM funcionarios
         WHERE REPLACE(REPLACE(REPLACE(cpf,'.',''),'-',''),' ','') = ?
            OR REPLACE(REPLACE(REPLACE(matricula,'.',''),'-',''),' ','') = ?
         LIMIT 1`,
        [digits, digits]
    );
    return row || null;
}

async function getColaboradorById(id) {
    const key = String(id || '').trim();
    if (!key) return null;
    return await db.sql.get('SELECT * FROM funcionarios WHERE id = ? LIMIT 1', [key]);
}

async function listEpis() {
    return await db.sql.all('SELECT * FROM epis ORDER BY nome ASC');
}

async function getEpiById(id) {
    const key = String(id || '').trim();
    if (!key) return null;
    return await db.sql.get('SELECT * FROM epis WHERE id = ? LIMIT 1', [key]);
}

async function getEpiByQr(codigoQr) {
    const key = String(codigoQr || '').trim();
    if (!key) return null;
    return await db.sql.get('SELECT * FROM epis WHERE codigo_qr = ? LIMIT 1', [key]);
}

async function getSaldoEmPosseByColaboradorId(colaboradorId) {
    const id = String(colaboradorId || '').trim();
    if (!id) return [];
    const rows = await db.sql.all(
        `SELECT item_id,
                SUM(CASE
                    WHEN tipo = 'retirada' THEN 1
                    WHEN tipo = 'devolucao' THEN -1
                    ELSE 0
                END) AS saldo
         FROM movimentacoes
         WHERE colaborador_id = ?
         GROUP BY item_id
         HAVING saldo > 0`,
        [id]
    );
    return (Array.isArray(rows) ? rows : []).map(r => ({
        id: String(r.item_id),
        quantidade: Number(r.saldo || 0)
    }));
}

async function getMovimentacoesCountByColaboradorId(colaboradorId) {
    const id = String(colaboradorId || '').trim();
    if (!id) return 0;
    const row = await db.sql.get(
        'SELECT COUNT(1) AS n FROM movimentacoes WHERE colaborador_id = ?',
        [id]
    );
    return row ? Number(row.n || 0) : 0;
}

async function insertMovimentacoes({ colaboradorId, tipo, origem, status, observacao, itemIds, createdAt }) {
    const nowIso = createdAt || new Date().toISOString();
    const ids = [];
    for (const itemId of itemIds) {
        const id = crypto.randomUUID();
        await db.sql.run(
            `INSERT INTO movimentacoes (id, colaborador_id, item_id, tipo, status, origem, observacao, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                String(colaboradorId),
                String(itemId),
                String(tipo),
                String(status || 'ok'),
                String(origem),
                observacao ? String(observacao) : null,
                nowIso
            ]
        );
        ids.push(id);
    }
    return ids;
}

async function applyEstoqueDelta({ itemId, delta }) {
    const id = String(itemId || '').trim();
    if (!id) return;
    const d = Number(delta || 0);
    await db.sql.run(
        `UPDATE epis
         SET estoque =
            CASE
                WHEN (COALESCE(estoque, 0) + ?) < 0 THEN 0
                ELSE (COALESCE(estoque, 0) + ?)
            END,
            updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [d, d, id]
    );
}

async function createDescontoEpi({ nomeFuncionario, cpfFuncionario, itens, parcelas, status, createdAt, updatedAt }) {
    const id = crypto.randomUUID();
    const nowIso = new Date().toISOString();
    await db.sql.run(
        `INSERT INTO descontos_epis (id, nome_funcionario, cpf_funcionario, itens, parcelas, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            id,
            nomeFuncionario ? String(nomeFuncionario) : null,
            cpfFuncionario ? String(cpfFuncionario) : null,
            JSON.stringify(Array.isArray(itens) ? itens : []),
            Number(parcelas || 1),
            String(status || 'pendente'),
            createdAt || nowIso,
            updatedAt || nowIso
        ]
    );
    return id;
}

async function appendAuditoriaLog({ requestId, actorUsername, actorRole, origem, acao, dados }) {
    const id = crypto.randomUUID();
    await db.sql.run(
        `INSERT INTO auditoria_logs (id, request_id, actor_username, actor_role, origem, acao, dados, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
            id,
            requestId ? String(requestId) : null,
            actorUsername ? String(actorUsername) : null,
            actorRole ? String(actorRole) : null,
            origem ? String(origem) : null,
            acao ? String(acao) : null,
            dados ? JSON.stringify(dados) : null
        ]
    );
    return id;
}

module.exports = {
    findColaboradorByDoc,
    getColaboradorById,
    listEpis,
    getEpiById,
    getEpiByQr,
    getSaldoEmPosseByColaboradorId,
    getMovimentacoesCountByColaboradorId,
    insertMovimentacoes,
    applyEstoqueDelta,
    createDescontoEpi,
    appendAuditoriaLog
};
