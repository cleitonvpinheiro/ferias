// migrate-to-mysql.js
'use strict';

require('dotenv').config();

console.log('--- DEBUG DOTENV ---');
console.log('process.env.DB_HOST:', process.env.MYSQL_HOST);
console.log('process.env.DB_NAME:', process.env.MYSQL_DB);
console.log('process.env.DB_USER:', process.env.MYSQL_USER);
console.log('process.env.DB_PASSWORD:', process.env.MYSQL_PASSWORD ? '********' : 'undefined/empty'); // Não exibe a senha
console.log('--------------------');



const path    = require('path');
const sqlite3 = require('sqlite3').verbose();
const mysql   = require('mysql2/promise');
const fs      = require('fs');

const SQLITE_PATH = path.join(__dirname,  'database', 'formularios.db');

const MYSQL_CONFIG = {
    host    : process.env.MYSQL_HOST     || '10.41.0.15',
    port    : Number(process.env.MYSQL_PORT || 3306),
    user    : process.env.MYSQL_USER     || process.env.MYSQL_USERNAME,
    password: process.env.MYSQL_PASSWORD || process.env.MYSQL_PASS,
    database: process.env.MYSQL_DB   || process.env.MYSQL_DATABASE,
    multipleStatements: true,
    timezone: '+00:00',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sqliteAll(db, sql, params = []) {
    return new Promise((resolve, reject) =>
        db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []))
    );
}

function sanitize(val) {
    if (val === undefined || val === null) return null;
    if (typeof val === 'number' && !Number.isFinite(val)) return null;
    return val;
}

async function insertBatch(conn, table, rows, batchSize = 200) {
    if (!rows || rows.length === 0) return 0;
    const columns = Object.keys(rows[0]);
    const placeholders = `(${columns.map(() => '?').join(', ')})`;
    const colList = columns.map(c => `\`${c}\``).join(', ');
    let total = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
        const chunk = rows.slice(i, i + batchSize);
        const values = chunk.map(row => columns.map(c => sanitize(row[c])));
        const sql = `INSERT IGNORE INTO \`${table}\` (${colList}) VALUES ${chunk.map(() => placeholders).join(', ')}`;
        await conn.execute(sql, values.flat());
        total += chunk.length;
    }
    return total;
}

async function sqliteTableExists(db, name) {
    const rows = await sqliteAll(db, `SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [name]);
    return rows.length > 0;
}

async function createIndexIfNotExists(conn, idxSql) {
    const m = idxSql.match(/INDEX\s+(?:IF NOT EXISTS\s+)?(\w+)\s+ON\s+(\w+)/i);
    if (!m) return;
    const [, idxName, tblName] = m;
    const [existing] = await conn.execute(
        `SELECT INDEX_NAME FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`,
        [MYSQL_CONFIG.database, tblName, idxName]
    );
    if (existing.length === 0) {
        const cleanSql = idxSql.replace(/IF NOT EXISTS\s+/i, '').replace(/;\s*$/, '');
        await conn.execute(cleanSql);
    }
}

// ─── Schema ───────────────────────────────────────────────────────────────────
const SCHEMA = [
    {
        table: 'funcionarios',
        ddl: `CREATE TABLE IF NOT EXISTS funcionarios (
            id            VARCHAR(36)  NOT NULL PRIMARY KEY,
            nome          TEXT         NOT NULL,
            cpf           VARCHAR(14)  NULL,
            matricula     VARCHAR(50)  NULL,
            cargo         VARCHAR(100) NULL,
            setor         VARCHAR(100) NULL,
            ativo         TINYINT(1)   NOT NULL DEFAULT 1,
            data_admissao VARCHAR(20)  NULL,
            nascimento    VARCHAR(20)  NULL,
            sexo          VARCHAR(20)  NULL,
            raca_cor      VARCHAR(50)  NULL,
            nacionalidade VARCHAR(80)  NULL,
            tipo_vinculo  VARCHAR(50)  NULL,
            contrato      VARCHAR(50)  NULL,
            pais_origem   VARCHAR(80)  NULL,
            estado_origem VARCHAR(50)  NULL,
            naturalidade  VARCHAR(80)  NULL,
            anotacoes     TEXT         NULL,
            foto          VARCHAR(255) NULL,
            banco         VARCHAR(80)  NULL,
            agencia       VARCHAR(20)  NULL,
            conta         VARCHAR(30)  NULL,
            tipo_conta    VARCHAR(30)  NULL,
            chave_pix     VARCHAR(150) NULL,
            status        VARCHAR(30)  NOT NULL DEFAULT 'Ativo',
            created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_funcionarios_cpf (cpf)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: [
            `CREATE INDEX IF NOT EXISTS idx_funcionarios_cpf      ON funcionarios(cpf)`,
            `CREATE INDEX IF NOT EXISTS idx_funcionarios_matricula ON funcionarios(matricula)`,
        ]
    },
    {
        table: 'epis',
        ddl: `CREATE TABLE IF NOT EXISTS epis (
            id             VARCHAR(36)  NOT NULL PRIMARY KEY,
            nome           TEXT         NULL,
            valor          DOUBLE       NULL,
            estoque        INT          NULL,
            possui_ca      TINYINT(1)   NOT NULL DEFAULT 1,
            ca_validade    DATETIME     NULL,
            codigo_qr      VARCHAR(100) NULL,
            vida_util_dias INT          NULL,
            status         VARCHAR(30)  NOT NULL DEFAULT 'ativo',
            created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_epis_codigo_qr (codigo_qr)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: []
    },
    {
        table: 'movimentacoes_epis',
        ddl: `CREATE TABLE IF NOT EXISTS movimentacoes_epis (
            id               VARCHAR(36) NOT NULL PRIMARY KEY,
            funcionario_id   VARCHAR(36) NULL,
            itens_retirados  LONGTEXT    NULL,
            itens_devolvidos LONGTEXT    NULL,
            evidencia        LONGTEXT    NULL,
            tipo_evidencia   VARCHAR(30) NULL,
            termo            LONGTEXT    NULL,
            created_at       DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: []
    },
    {
        table: 'descontos_epis',
        ddl: `CREATE TABLE IF NOT EXISTS descontos_epis (
            id               VARCHAR(36)  NOT NULL PRIMARY KEY,
            nome_funcionario VARCHAR(150) NULL,
            cpf_funcionario  VARCHAR(14)  NULL,
            itens            LONGTEXT     NULL,
            parcelas         INT          NULL,
            status           VARCHAR(30)  NOT NULL DEFAULT 'pendente',
            created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: []
    },
    {
        table: 'movimentacoes',
        ddl: `CREATE TABLE IF NOT EXISTS movimentacoes (
            id             VARCHAR(36) NOT NULL PRIMARY KEY,
            colaborador_id VARCHAR(36) NOT NULL,
            item_id        VARCHAR(36) NOT NULL,
            tipo           VARCHAR(50) NOT NULL,
            status         VARCHAR(30) NOT NULL DEFAULT 'ok',
            origem         VARCHAR(80) NOT NULL,
            observacao     TEXT        NULL,
            created_at     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: [
            `CREATE INDEX IF NOT EXISTS idx_movimentacoes_colaborador_created ON movimentacoes(colaborador_id, created_at)`,
            `CREATE INDEX IF NOT EXISTS idx_movimentacoes_item_created         ON movimentacoes(item_id, created_at)`,
        ]
    },
    {
        table: 'movimentacoes_rh',
        ddl: `CREATE TABLE IF NOT EXISTS movimentacoes_rh (
            id               VARCHAR(36)  NOT NULL PRIMARY KEY,
            nome_colaborador VARCHAR(150) NULL,
            setor            VARCHAR(100) NULL,
            cargo            VARCHAR(100) NULL,
            status           VARCHAR(30)  NOT NULL DEFAULT 'pendente',
            dados            LONGTEXT     NULL,
            created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: []
    },
    {
        table: 'auditoria_logs',
        ddl: `CREATE TABLE IF NOT EXISTS auditoria_logs (
            id             VARCHAR(36)  NOT NULL PRIMARY KEY,
            request_id     VARCHAR(36)  NULL,
            actor_username VARCHAR(100) NULL,
            actor_role     VARCHAR(50)  NULL,
            origem         VARCHAR(100) NULL,
            acao           VARCHAR(150) NULL,
            dados          LONGTEXT     NULL,
            created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: [
            `CREATE INDEX IF NOT EXISTS idx_auditoria_created      ON auditoria_logs(created_at)`,
            `CREATE INDEX IF NOT EXISTS idx_auditoria_actor_created ON auditoria_logs(actor_username, created_at)`,
        ]
    },
    {
        table: 'solicitacoes_epis',
        ddl: `CREATE TABLE IF NOT EXISTS solicitacoes_epis (
            id                VARCHAR(36)  NOT NULL PRIMARY KEY,
            funcionario_id    VARCHAR(36)  NOT NULL,
            tipo              VARCHAR(30)  NOT NULL DEFAULT 'retirada',
            itens_solicitados LONGTEXT     NOT NULL,
            status            VARCHAR(30)  NOT NULL DEFAULT 'pendente',
            atendido_at       DATETIME     NULL,
            atendido_por      VARCHAR(100) NULL,
            assinatura        LONGTEXT     NULL,
            assinatura_tipo   VARCHAR(30)  NULL,
            assinatura_at     DATETIME     NULL,
            assinatura_por    VARCHAR(100) NULL,
            evidencia_foto    LONGTEXT     NULL,
            created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: [
            `CREATE INDEX IF NOT EXISTS idx_solicitacoes_epis_status_created     ON solicitacoes_epis(status, created_at)`,
            `CREATE INDEX IF NOT EXISTS idx_solicitacoes_epis_funcionario_created ON solicitacoes_epis(funcionario_id, created_at)`,
        ]
    },
    {
        table: 'ciclos_uniforme',
        ddl: `CREATE TABLE IF NOT EXISTS ciclos_uniforme (
            id             VARCHAR(36)  NOT NULL PRIMARY KEY,
            funcionario_id VARCHAR(36)  NOT NULL,
            data_retirada  DATETIME     NULL,
            data_devolucao DATETIME     NULL,
            status         VARCHAR(30)  NOT NULL DEFAULT 'em_uso',
            evidencias     LONGTEXT     NULL,
            criado_por     VARCHAR(100) NULL,
            finalizado_por VARCHAR(100) NULL,
            observacoes    TEXT         NULL,
            created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: [
            `CREATE INDEX IF NOT EXISTS idx_ciclos_uniforme_func_status_retirada ON ciclos_uniforme(funcionario_id, status, data_retirada)`,
        ]
    },
    {
        table: 'ciclo_itens',
        ddl: `CREATE TABLE IF NOT EXISTS ciclo_itens (
            id               VARCHAR(36) NOT NULL PRIMARY KEY,
            ciclo_id         VARCHAR(36) NOT NULL,
            item_id          VARCHAR(36) NOT NULL,
            item_tipo        VARCHAR(20) NOT NULL DEFAULT 'epi',
            status_devolucao VARCHAR(30) NULL,
            evidencia_foto   LONGTEXT    NULL,
            created_at       DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (ciclo_id) REFERENCES ciclos_uniforme(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: [
            `CREATE INDEX IF NOT EXISTS idx_ciclo_itens_ciclo ON ciclo_itens(ciclo_id)`,
        ]
    },
    {
        table: 'ocorrencias_uniforme',
        ddl: `CREATE TABLE IF NOT EXISTS ocorrencias_uniforme (
            id           VARCHAR(36) NOT NULL PRIMARY KEY,
            ciclo_id     VARCHAR(36) NOT NULL,
            tipo         VARCHAR(80) NOT NULL,
            status       VARCHAR(30) NOT NULL DEFAULT 'pendente',
            valor        DOUBLE      NULL,
            parcelas     INT         NULL,
            aprovado_por VARCHAR(100) NULL,
            dados        LONGTEXT    NULL,
            created_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (ciclo_id) REFERENCES ciclos_uniforme(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: [
            `CREATE INDEX IF NOT EXISTS idx_ocorrencias_uniforme_status_created ON ocorrencias_uniforme(status, created_at)`,
        ]
    },
    {
        table: 'descontos_uniforme',
        ddl: `CREATE TABLE IF NOT EXISTS descontos_uniforme (
            id             VARCHAR(36) NOT NULL PRIMARY KEY,
            funcionario_id VARCHAR(36) NULL,
            ocorrencia_id  VARCHAR(36) NULL,
            valor_total    DOUBLE      NULL,
            parcelas       INT         NULL,
            status         VARCHAR(30) NOT NULL DEFAULT 'pendente',
            dados          LONGTEXT    NULL,
            created_at     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (ocorrencia_id) REFERENCES ocorrencias_uniforme(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: [
            `CREATE INDEX IF NOT EXISTS idx_descontos_uniforme_status_created ON descontos_uniforme(status, created_at)`,
        ]
    },
    {
        table: 'kits_uniforme',
        ddl: `CREATE TABLE IF NOT EXISTS kits_uniforme (
            id         VARCHAR(36)  NOT NULL PRIMARY KEY,
            setor      VARCHAR(100) NULL,
            cargo      VARCHAR(100) NULL,
            itens      LONGTEXT     NOT NULL,
            ativo      TINYINT(1)   NOT NULL DEFAULT 1,
            created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: [
            `CREATE INDEX IF NOT EXISTS idx_kits_uniforme_setor_cargo ON kits_uniforme(setor, cargo, ativo)`,
        ]
    },
    {
        table: 'gestor_equipes',
        ddl: `CREATE TABLE IF NOT EXISTS gestor_equipes (
            gestor_username VARCHAR(100) NOT NULL,
            funcionario_id  VARCHAR(36)  NOT NULL,
            created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (gestor_username, funcionario_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: [
            `CREATE INDEX IF NOT EXISTS idx_gestor_equipes_gestor ON gestor_equipes(gestor_username)`,
            `CREATE INDEX IF NOT EXISTS idx_gestor_equipes_func   ON gestor_equipes(funcionario_id)`,
        ]
    },
    {
        table: 'gestor_setores',
        ddl: `CREATE TABLE IF NOT EXISTS gestor_setores (
            gestor_username VARCHAR(100) NOT NULL,
            setor           VARCHAR(100) NOT NULL,
            created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (gestor_username, setor)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: [
            `CREATE INDEX IF NOT EXISTS idx_gestor_setores_gestor ON gestor_setores(gestor_username)`,
        ]
    },
    {
        table: 'setores',
        ddl: `CREATE TABLE IF NOT EXISTS setores (
            nome       VARCHAR(150) NOT NULL PRIMARY KEY,
            ativo      TINYINT(1)   NOT NULL DEFAULT 1,
            created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: [
            `CREATE INDEX IF NOT EXISTS idx_setores_ativo_nome ON setores(ativo, nome)`,
        ]
    },
    {
        table: 'disciplinar_registros',
        ddl: `CREATE TABLE IF NOT EXISTS disciplinar_registros (
            id             VARCHAR(36) NOT NULL PRIMARY KEY,
            funcionario_id VARCHAR(36) NOT NULL,
            tipo           VARCHAR(80) NOT NULL,
            dados          LONGTEXT    NULL,
            created_at     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: [
            `CREATE INDEX IF NOT EXISTS idx_disciplinar_funcionario_created ON disciplinar_registros(funcionario_id, created_at)`,
            `CREATE INDEX IF NOT EXISTS idx_disciplinar_tipo_created         ON disciplinar_registros(tipo, created_at)`,
        ]
    },
    {
        table: 'disciplinar_modelos',
        ddl: `CREATE TABLE IF NOT EXISTS disciplinar_modelos (
            id            VARCHAR(36)  NOT NULL PRIMARY KEY,
            filename      VARCHAR(255) NOT NULL,
            original_name VARCHAR(255) NULL,
            mimetype      VARCHAR(100) NULL,
            uploaded_by   VARCHAR(100) NULL,
            created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: []
    },
    {
        table: 'formularios_dashboards',
        ddl: `CREATE TABLE IF NOT EXISTS formularios_dashboards (
            id         VARCHAR(36) NOT NULL PRIMARY KEY,
            titulo     TEXT        NULL,
            tipo       VARCHAR(80) NULL,
            created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: [
            `CREATE INDEX IF NOT EXISTS idx_form_dashboards_tipo_updated ON formularios_dashboards(tipo, updated_at)`,
        ]
    },
    {
        table: 'formularios',
        ddl: `CREATE TABLE IF NOT EXISTS formularios (
            id            VARCHAR(36) NOT NULL PRIMARY KEY,
            titulo        TEXT        NULL,
            tipo          VARCHAR(80) NULL,
            questoes      LONGTEXT    NULL,
            ativo         TINYINT(1)  NOT NULL DEFAULT 1,
            dashboard_id  VARCHAR(36) NULL,
            publico       TINYINT(1)  NOT NULL DEFAULT 1,
            allowed_roles LONGTEXT    NULL,
            created_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (dashboard_id) REFERENCES formularios_dashboards(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: [
            `CREATE INDEX IF NOT EXISTS idx_formularios_dashboard_id ON formularios(dashboard_id)`,
        ]
    },
    {
        table: 'respostas_formularios',
        ddl: `CREATE TABLE IF NOT EXISTS respostas_formularios (
            id             VARCHAR(36) NOT NULL PRIMARY KEY,
            formulario_id  VARCHAR(36) NULL,
            funcionario_id VARCHAR(36) NULL,
            respostas      LONGTEXT    NULL,
            created_at     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: []
    },
    {
        table: 'role_permissions',
        ddl: `CREATE TABLE IF NOT EXISTS role_permissions (
            role            VARCHAR(80) NOT NULL PRIMARY KEY,
            protected_paths LONGTEXT    NULL,
            updated_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: []
    },
    {
        table: 'intranet_posts',
        ddl: `CREATE TABLE IF NOT EXISTS intranet_posts (
            id             VARCHAR(36)  NOT NULL PRIMARY KEY,
            tipo           VARCHAR(30)  NOT NULL DEFAULT 'post',
            titulo         TEXT         NULL,
            conteudo       LONGTEXT     NOT NULL,
            imagem_url     TEXT         NULL,
            autor_username VARCHAR(100) NULL,
            autor_nome     VARCHAR(150) NULL,
            autor_role     VARCHAR(50)  NULL,
            created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: [
            `CREATE INDEX IF NOT EXISTS idx_intranet_posts_created     ON intranet_posts(created_at)`,
            `CREATE INDEX IF NOT EXISTS idx_intranet_posts_tipo_created ON intranet_posts(tipo, created_at)`,
        ]
    },
    {
        table: 'intranet_events',
        ddl: `CREATE TABLE IF NOT EXISTS intranet_events (
            id          VARCHAR(36)  NOT NULL PRIMARY KEY,
            titulo      TEXT         NOT NULL,
            descricao   TEXT         NULL,
            data_inicio DATETIME     NOT NULL,
            data_fim    DATETIME     NULL,
            local       VARCHAR(200) NULL,
            criado_por  VARCHAR(100) NULL,
            created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: [
            `CREATE INDEX IF NOT EXISTS idx_intranet_events_data_inicio ON intranet_events(data_inicio)`,
        ]
    },
    {
        table: 'notifications',
        ddl: `CREATE TABLE IF NOT EXISTS notifications (
            id         VARCHAR(36)  NOT NULL PRIMARY KEY,
            username   VARCHAR(100) NOT NULL,
            tipo       VARCHAR(30)  NOT NULL DEFAULT 'info',
            titulo     TEXT         NOT NULL,
            mensagem   TEXT         NULL,
            link       TEXT         NULL,
            read_at    DATETIME     NULL,
            created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: [
            `CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(username, created_at)`,
            `CREATE INDEX IF NOT EXISTS idx_notifications_user_read    ON notifications(username, read_at)`,
        ]
    },
    {
        table: 'avaliacao_ciclos',
        ddl: `CREATE TABLE IF NOT EXISTS avaliacao_ciclos (
            id              VARCHAR(36) NOT NULL PRIMARY KEY,
            titulo          TEXT        NOT NULL,
            descricao       TEXT        NULL,
            modelo          VARCHAR(20) NOT NULL DEFAULT '180',
            tipo_formulario VARCHAR(80) NOT NULL,
            pesos_categoria LONGTEXT    NULL,
            pesos_relacao   LONGTEXT    NULL,
            max_score_item  DOUBLE      NOT NULL DEFAULT 7.7,
            data_inicio     DATETIME    NULL,
            data_fim        DATETIME    NULL,
            status          VARCHAR(30) NOT NULL DEFAULT 'ativo',
            criado_por      VARCHAR(100) NULL,
            created_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: [
            `CREATE INDEX IF NOT EXISTS idx_avaliacao_ciclos_status_created ON avaliacao_ciclos(status, created_at)`,
        ]
    },
    {
        table: 'avaliacao_participantes',
        ddl: `CREATE TABLE IF NOT EXISTS avaliacao_participantes (
            id                 VARCHAR(36)  NOT NULL PRIMARY KEY,
            ciclo_id           VARCHAR(36)  NOT NULL,
            avaliado_id        VARCHAR(36)  NOT NULL,
            avaliado_nome      VARCHAR(150) NULL,
            avaliado_setor     VARCHAR(100) NULL,
            avaliado_cargo     VARCHAR(100) NULL,
            avaliador_username VARCHAR(100) NOT NULL,
            avaliador_nome     VARCHAR(150) NULL,
            avaliador_role     VARCHAR(50)  NULL,
            relacao            VARCHAR(30)  NOT NULL DEFAULT 'gestor',
            peso               DOUBLE       NOT NULL DEFAULT 1,
            status             VARCHAR(30)  NOT NULL DEFAULT 'pendente',
            avaliacao_id       VARCHAR(36)  NULL,
            started_at         DATETIME     NULL,
            completed_at       DATETIME     NULL,
            created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_avaliacao_participantes_unique (ciclo_id, avaliado_id, avaliador_username, relacao),
            FOREIGN KEY (ciclo_id)    REFERENCES avaliacao_ciclos(id) ON DELETE CASCADE,
            FOREIGN KEY (avaliado_id) REFERENCES funcionarios(id)     ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: [
            `CREATE INDEX IF NOT EXISTS idx_avaliacao_participantes_avaliador_status ON avaliacao_participantes(avaliador_username, status, created_at)`,
            `CREATE INDEX IF NOT EXISTS idx_avaliacao_participantes_ciclo            ON avaliacao_participantes(ciclo_id, created_at)`,
        ]
    },
    {
        table: 'avaliacao_consolidado',
        ddl: `CREATE TABLE IF NOT EXISTS avaliacao_consolidado (
            id          VARCHAR(36) NOT NULL PRIMARY KEY,
            ciclo_id    VARCHAR(36) NOT NULL,
            avaliado_id VARCHAR(36) NOT NULL,
            dados       LONGTEXT    NULL,
            created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_avaliacao_consolidado_unique (ciclo_id, avaliado_id),
            FOREIGN KEY (ciclo_id)    REFERENCES avaliacao_ciclos(id) ON DELETE CASCADE,
            FOREIGN KEY (avaliado_id) REFERENCES funcionarios(id)     ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: [
            `CREATE INDEX IF NOT EXISTS idx_avaliacao_consolidado_ciclo ON avaliacao_consolidado(ciclo_id, created_at)`,
        ]
    },
    {
        table: 'avaliacao_prazos',
        ddl: `CREATE TABLE IF NOT EXISTS avaliacao_prazos (
            tipo        VARCHAR(80) NOT NULL PRIMARY KEY,
            data_inicio TEXT        NULL,
            data_fim    TEXT        NULL,
            updated_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: []
    },
    {
        table: 'solicitacoes_ferias',
        ddl: `CREATE TABLE IF NOT EXISTS solicitacoes_ferias (
            id              VARCHAR(36)  NOT NULL PRIMARY KEY,
            funcionario_id  VARCHAR(36)  NULL,
            nome            VARCHAR(150) NULL,
            setor           VARCHAR(100) NULL,
            inicio          VARCHAR(30)  NULL,
            inicio2         VARCHAR(30)  NULL,
            tipo_gozo       VARCHAR(50)  NULL,
            decimo          VARCHAR(10)  NULL,
            gestor_email    VARCHAR(150) NULL,
            nome_gestor     VARCHAR(150) NULL,
            status          VARCHAR(30)  NULL,
            status_rh       VARCHAR(30)  NULL,
            sugestao_data   VARCHAR(30)  NULL,
            justificativa   TEXT         NULL,
            assinatura      LONGTEXT     NULL,
            signature_token VARCHAR(100) NULL,
            signed_at       DATETIME     NULL,
            created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: []
    },
    {
        table: 'historico_solicitacoes',
        ddl: `CREATE TABLE IF NOT EXISTS historico_solicitacoes (
            id             INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
            solicitacao_id VARCHAR(36)  NOT NULL,
            data           DATETIME     NULL,
            acao           VARCHAR(100) NULL,
            ator           VARCHAR(100) NULL,
            justificativa  TEXT         NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: []
    },
    {
        table: 'taxas',
        ddl: `CREATE TABLE IF NOT EXISTS taxas (
            id                 VARCHAR(36)  NOT NULL PRIMARY KEY,
            nome_taxa          VARCHAR(150) NULL,
            cpf                VARCHAR(14)  NULL,
            funcao             VARCHAR(100) NULL,
            forma_pagamento    VARCHAR(50)  NULL,
            chave_pix          VARCHAR(150) NULL,
            banco              VARCHAR(80)  NULL,
            agencia            VARCHAR(20)  NULL,
            conta              VARCHAR(30)  NULL,
            tipo_conta         VARCHAR(30)  NULL,
            departamento       VARCHAR(100) NULL,
            motivo             LONGTEXT     NULL,
            detalhe_motivo     TEXT         NULL,
            antecessor         VARCHAR(150) NULL,
            valores            LONGTEXT     NULL,
            status             VARCHAR(30)  NULL,
            email_gestor       VARCHAR(150) NULL,
            email_solicitante  VARCHAR(150) NULL,
            approval_token     VARCHAR(100) NULL,
            signature_token    VARCHAR(100) NULL,
            assinatura         LONGTEXT     NULL,
            aprovador_nome     VARCHAR(150) NULL,
            aprovador_username VARCHAR(100) NULL,
            created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: []
    },
    {
        table: 'vagas',
        ddl: `CREATE TABLE IF NOT EXISTS vagas (
            id           VARCHAR(36)  NOT NULL PRIMARY KEY,
            titulo       TEXT         NULL,
            descricao    TEXT         NULL,
            requisitos   TEXT         NULL,
            status       VARCHAR(30)  NULL,
            ativa        TINYINT(1)   NOT NULL DEFAULT 1,
            departamento VARCHAR(100) NULL,
            dados        LONGTEXT     NULL,
            created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: []
    },
    {
        table: 'candidatos',
        ddl: `CREATE TABLE IF NOT EXISTS candidatos (
            id               VARCHAR(36)  NOT NULL PRIMARY KEY,
            nome             VARCHAR(150) NULL,
            email            VARCHAR(150) NULL,
            telefone         VARCHAR(30)  NULL,
            curriculo        LONGTEXT     NULL,
            status           VARCHAR(30)  NULL,
            observacao       TEXT         NULL,
            data_entrevista  DATETIME     NULL,
            local_entrevista VARCHAR(200) NULL,
            entrevistador    VARCHAR(150) NULL,
            historico        LONGTEXT     NULL,
            dados            LONGTEXT     NULL,
            created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: []
    },
    {
        table: 'users',
        ddl: `CREATE TABLE IF NOT EXISTS users (
            id            INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
            username      VARCHAR(100) NOT NULL,
            password      VARCHAR(255) NOT NULL,
            role          VARCHAR(50)  NOT NULL,
            name          VARCHAR(150) NULL,
            email         VARCHAR(150) NULL,
            blocked_paths LONGTEXT     NULL,
            created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_users_username (username)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: []
    },
    {
        table: 'avaliacoes',
        ddl: `CREATE TABLE IF NOT EXISTS avaliacoes (
            id          VARCHAR(36)  NOT NULL PRIMARY KEY,
            tipo        VARCHAR(80)  NULL,
            funcionario VARCHAR(150) NULL,
            avaliador   VARCHAR(150) NULL,
            dados       LONGTEXT     NULL,
            created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: []
    },
    {
        table: 'acessos',
        ddl: `CREATE TABLE IF NOT EXISTS acessos (
            id        INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
            tipo      VARCHAR(50)  NULL,
            nome      VARCHAR(150) NULL,
            empresa   VARCHAR(150) NULL,
            documento VARCHAR(50)  NULL,
            placa     VARCHAR(20)  NULL,
            entrada   DATETIME     NULL,
            saida     DATETIME     NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: []
    },
    {
        table: 'uniformes',
        ddl: `CREATE TABLE IF NOT EXISTS uniformes (
            id         VARCHAR(36) NOT NULL PRIMARY KEY,
            nome       TEXT        NULL,
            itens      LONGTEXT    NULL,
            status     VARCHAR(30) NULL,
            created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: []
    },
    {
        table: 'entrevistas_desligamento',
        ddl: `CREATE TABLE IF NOT EXISTS entrevistas_desligamento (
            id         VARCHAR(36)  NOT NULL PRIMARY KEY,
            nome       VARCHAR(150) NULL,
            setor      VARCHAR(100) NULL,
            dados      LONGTEXT     NULL,
            created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: []
    },
    {
        table: 'recrutamento_interno',
        ddl: `CREATE TABLE IF NOT EXISTS recrutamento_interno (
            id               VARCHAR(36)  NOT NULL PRIMARY KEY,
            nome             VARCHAR(150) NULL,
            cargo_pretendido VARCHAR(100) NULL,
            setor            VARCHAR(100) NULL,
            status           VARCHAR(30)  NULL,
            observacao_rh    TEXT         NULL,
            dados            LONGTEXT     NULL,
            created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: []
    },
    {
        table: 'onthejob',
        ddl: `CREATE TABLE IF NOT EXISTS onthejob (
            id               VARCHAR(36)  NOT NULL PRIMARY KEY,
            nome_colaborador VARCHAR(150) NULL,
            empresa          VARCHAR(150) NULL,
            status           VARCHAR(30)  NULL,
            dados            LONGTEXT     NULL,
            created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: []
    },
    {
        table: 'solicitacoes_taxa',
        ddl: `CREATE TABLE IF NOT EXISTS solicitacoes_taxa (
            id                VARCHAR(36)  NOT NULL PRIMARY KEY,
            solicitante       VARCHAR(150) NULL,
            email_solicitante VARCHAR(150) NULL,
            departamento      VARCHAR(100) NULL,
            funcao_necessaria VARCHAR(100) NULL,
            motivo            TEXT         NULL,
            detalhe_motivo    TEXT         NULL,
            data_necessaria   VARCHAR(30)  NULL,
            horario_inicio    VARCHAR(10)  NULL,
            horario_fim       VARCHAR(10)  NULL,
            quantidade_vagas  INT          NULL,
            observacoes       TEXT         NULL,
            status            VARCHAR(30)  NULL,
            created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
        indexes: []
    },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  Migração SQLite → MySQL');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  Host    : ${MYSQL_CONFIG.host}:${MYSQL_CONFIG.port}`);
    console.log(`  Database: ${MYSQL_CONFIG.database}`);
    console.log(`  User    : ${MYSQL_CONFIG.user}`);
    console.log(`  SQLite  : ${SQLITE_PATH}`);
    console.log('═══════════════════════════════════════════════════════\n');

    if (!fs.existsSync(SQLITE_PATH)) {
        console.error(`❌ Banco SQLite não encontrado: ${SQLITE_PATH}`);
        process.exit(1);
    }

    if (!MYSQL_CONFIG.user || !MYSQL_CONFIG.database) {
        console.error('❌ Variáveis de ambiente do MySQL não configuradas.');
        console.error('   Esperado no .env: MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_NAME');
        process.exit(1);
    }

    // Abrir SQLite em modo leitura
    const sqliteDb = await new Promise((resolve, reject) => {
        const db = new sqlite3.Database(SQLITE_PATH, sqlite3.OPEN_READONLY, (err) =>
            err ? reject(err) : resolve(db)
        );
    });
    console.log('✅ SQLite aberto em modo leitura\n');

    // Conectar MySQL
    let conn;
    try {
        conn = await mysql.createConnection(MYSQL_CONFIG);
        console.log('✅ Conectado ao MySQL\n');
    } catch (err) {
        console.error('❌ Falha na conexão MySQL:', err.message);
        sqliteDb.close();
        process.exit(1);
    }

    try {
        await conn.execute('SET FOREIGN_KEY_CHECKS = 0');
        await conn.execute(`SET SESSION sql_mode = ''`);
        await conn.execute(`SET time_zone = '+00:00'`);

        // ── Criar schema ────────────────────────────────────────────────────
        console.log('── Criando schema ──────────────────────────────────────');
        for (const entry of SCHEMA) {
            try {
                await conn.execute(entry.ddl);
                for (const idxSql of (entry.indexes || [])) {
                    await createIndexIfNotExists(conn, idxSql);
                }
                console.log(`  ✓ ${entry.table}`);
            } catch (e) {
                console.warn(`  ⚠ ${entry.table}: ${e.message}`);
            }
        }

        // ── Migrar dados ────────────────────────────────────────────────────
        console.log('\n── Migrando dados ──────────────────────────────────────');
        const summary = [];

        for (const entry of SCHEMA) {
            const { table } = entry;

            const exists = await sqliteTableExists(sqliteDb, table);
            if (!exists) {
                summary.push({ table, status: 'ausente no SQLite', count: 0 });
                continue;
            }

            try {
                const rows = await sqliteAll(sqliteDb, `SELECT * FROM \`${table}\``);
                if (rows.length === 0) {
                    summary.push({ table, status: 'vazia', count: 0 });
                    console.log(`  - ${table.padEnd(38)} (vazia)`);
                    continue;
                }

                const count = await insertBatch(conn, table, rows);
                summary.push({ table, status: 'ok', count });
                console.log(`  ✓ ${table.padEnd(38)} ${String(count).padStart(6)} linha(s)`);
            } catch (e) {
                summary.push({ table, status: `ERRO: ${e.message}`, count: 0 });
                console.error(`  ✗ ${table}: ${e.message}`);
            }
        }

        await conn.execute('SET FOREIGN_KEY_CHECKS = 1');

        // ── Relatório ───────────────────────────────────────────────────────
        const totalLinhas  = summary.reduce((s, r) => s + r.count, 0);
        const totalErros   = summary.filter(r => r.status.startsWith('ERRO')).length;
        const totalVazias  = summary.filter(r => r.status === 'vazia').length;
        const totalAusente = summary.filter(r => r.status === 'ausente no SQLite').length;

        console.log('\n═══════════════════════════════════════════════════════');
        console.log('  Relatório Final');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`  Linhas migradas  : ${totalLinhas}`);
        console.log(`  Tabelas OK       : ${summary.filter(r => r.status === 'ok').length}`);
        console.log(`  Tabelas vazias   : ${totalVazias}`);
        console.log(`  Ausentes SQLite  : ${totalAusente}`);
        console.log(`  Erros            : ${totalErros}`);

        if (totalErros > 0) {
            console.log('\n  Tabelas com erro:');
            summary.filter(r => r.status.startsWith('ERRO'))
                .forEach(r => console.error(`    ✗ ${r.table}: ${r.status}`));
        }

        console.log('\n✅ Migração concluída!\n');

    } finally {
        await conn.end().catch(() => {});
        sqliteDb.close();
    }
}

main().catch(err => {
    console.error('\n❌ Erro fatal:', err.message);
    process.exit(1);
});