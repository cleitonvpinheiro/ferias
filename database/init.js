const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'formularios.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
const DATA_DIR = path.join(__dirname, '..', 'data');

const db = new sqlite3.Database(DB_PATH);

function readJSON(filename) {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) return [];
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        console.error(`Erro ao ler ${filename}:`, e);
        return [];
    }
}

const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');

db.serialize(() => {
    // 1. Create Tables
    db.exec(schema, (err) => {
        if (err) {
            console.error('Erro ao criar schema:', err);
            return;
        }
        console.log('Tabelas criadas com sucesso.');

        // 2. Migrate Data Sequentially
        try {
            migrateFuncionarios(() => {
                migrateSolicitacoes(() => {
                    migrateTaxas(() => {
                        migrateCandidatos(() => {
                            migrateVagas(() => {
                                migrateMovimentacoes(() => {
                                    migrateEpis(() => {
                                        migrateMovimentacoesEpis(() => {
                                            migrateDescontosEpis(() => {
                                                migrateEntrevistasDesligamento(() => {
                                                    migrateRecrutamentoInterno(() => {
                                                        migrateOnTheJob(() => {
                                                            migrateAvaliacoes(() => {
                                                                migrateAcessos(() => {
                                                                    migrateUniformes(() => {
                                                                        migrateFormularios(() => {
                                                                            console.log("Migração concluída.");
                                                                            db.close();
                                                                        });
                                                                    });
                                                                });
                                                            });
                                                        });
                                                    });
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        } catch (e) {
            console.error(e);
        }
    });
});

function migrateEpis(cb) {
    const data = readJSON('epis.json');
    if (data.length === 0) return cb();

    const stmt = db.prepare(`INSERT OR REPLACE INTO epis (id, nome, valor, estoque, possui_ca, ca_validade, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        data.forEach(item => {
            stmt.run(
                item.id,
                item.nome,
                item.valor,
                item.estoque,
                item.possui_ca == null ? 1 : (item.possui_ca ? 1 : 0),
                item.ca_validade,
                item.createdAt,
                item.updatedAt
            );
        });
        db.run("COMMIT", () => {
            console.log(`Migrados ${data.length} EPIs.`);
            stmt.finalize();
            cb();
        });
    });
}

function migrateMovimentacoesEpis(cb) {
    const data = readJSON('movimentacoes_epis.json');
    if (data.length === 0) return cb();

    const stmt = db.prepare(`INSERT OR REPLACE INTO movimentacoes_epis (id, funcionario_id, itens_retirados, itens_devolvidos, evidencia, tipo_evidencia, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`);

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        data.forEach(item => {
            stmt.run(
                item.id,
                item.funcionario_id,
                JSON.stringify(item.itens_retirados),
                JSON.stringify(item.itens_devolvidos),
                item.evidencia,
                item.tipo_evidencia,
                item.createdAt
            );
        });
        db.run("COMMIT", () => {
            console.log(`Migrados ${data.length} movimentacoes de EPIs.`);
            stmt.finalize();
            cb();
        });
    });
}

function migrateDescontosEpis(cb) {
    const data = readJSON('descontos_epis.json');
    if (data.length === 0) return cb();

    const stmt = db.prepare(`INSERT OR REPLACE INTO descontos_epis (id, nome_funcionario, cpf_funcionario, itens, parcelas, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        data.forEach(item => {
            stmt.run(
                item.id,
                item.nome_funcionario,
                item.cpf_funcionario,
                JSON.stringify(item.itens),
                item.parcelas,
                item.status,
                item.createdAt,
                item.updatedAt
            );
        });
        db.run("COMMIT", () => {
            console.log(`Migrados ${data.length} descontos de EPIs.`);
            stmt.finalize();
            cb();
        });
    });
}

function migrateEntrevistasDesligamento(cb) {
    const data = readJSON('entrevistas_desligamento.json');
    if (data.length === 0) return cb();

    const stmt = db.prepare(`INSERT OR REPLACE INTO entrevistas_desligamento (id, nome, setor, dados, created_at) VALUES (?, ?, ?, ?, ?)`);

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        data.forEach(item => {
            const { id, nome, setor, createdAt, ...rest } = item;
            stmt.run(
                id,
                nome,
                setor,
                JSON.stringify(rest),
                createdAt
            );
        });
        db.run("COMMIT", () => {
            console.log(`Migrados ${data.length} entrevistas de desligamento.`);
            stmt.finalize();
            cb();
        });
    });
}

function migrateRecrutamentoInterno(cb) {
    const data = readJSON('recrutamento_interno.json');
    if (data.length === 0) return cb();

    const stmt = db.prepare(`INSERT OR REPLACE INTO recrutamento_interno (id, nome, cargo_pretendido, setor, status, observacao_rh, dados, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        data.forEach(item => {
            const { id, nome, cargoPretendido, setor, status, observacao_rh, createdAt, updatedAt, ...rest } = item;
            stmt.run(
                id,
                nome,
                cargoPretendido,
                setor,
                status,
                observacao_rh,
                JSON.stringify(rest),
                createdAt,
                updatedAt
            );
        });
        db.run("COMMIT", () => {
            console.log(`Migrados ${data.length} recrutamento interno.`);
            stmt.finalize();
            cb();
        });
    });
}

function migrateOnTheJob(cb) {
    const data = readJSON('onthejob.json');
    if (data.length === 0) return cb();

    const stmt = db.prepare(`INSERT OR REPLACE INTO onthejob (id, nome_colaborador, empresa, status, dados, created_at) VALUES (?, ?, ?, ?, ?, ?)`);

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        data.forEach(item => {
            const { id, colaboradorNome, empresa, status, createdAt, ...rest } = item;
            stmt.run(
                id,
                colaboradorNome,
                empresa,
                status,
                JSON.stringify(rest),
                createdAt
            );
        });
        db.run("COMMIT", () => {
            console.log(`Migrados ${data.length} on the job.`);
            stmt.finalize();
            cb();
        });
    });
}

function migrateAvaliacoes(cb) {
    const data = readJSON('avaliacoes.json');
    if (data.length === 0) return cb();

    const stmt = db.prepare(`INSERT OR REPLACE INTO avaliacoes (id, tipo, funcionario, avaliador, dados, created_at) VALUES (?, ?, ?, ?, ?, ?)`);

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        data.forEach(item => {
            const { id, tipo, funcionario, avaliador, createdAt, ...rest } = item;
            stmt.run(
                id,
                tipo,
                funcionario,
                avaliador,
                JSON.stringify(rest),
                createdAt
            );
        });
        db.run("COMMIT", () => {
            console.log(`Migrados ${data.length} avaliacoes.`);
            stmt.finalize();
            cb();
        });
    });
}

function migrateAcessos(cb) {
    const data = readJSON('acessos.json');
    if (data.length === 0) return cb();

    const stmt = db.prepare(`INSERT OR REPLACE INTO acessos (tipo, nome, empresa, documento, placa, entrada, saida) VALUES (?, ?, ?, ?, ?, ?, ?)`);

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        data.forEach(item => {
            stmt.run(
                item.tipo,
                item.nome,
                item.empresa,
                item.documento,
                item.placa,
                item.entrada,
                item.saida
            );
        });
        db.run("COMMIT", () => {
            console.log(`Migrados ${data.length} acessos.`);
            stmt.finalize();
            cb();
        });
    });
}

function migrateUniformes(cb) {
    const data = readJSON('uniformes.json');
    if (data.length === 0) return cb();

    const stmt = db.prepare(`INSERT OR REPLACE INTO uniformes (id, nome, itens, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`);

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        data.forEach(item => {
            stmt.run(
                item.id,
                item.nome,
                JSON.stringify(item.itens),
                item.status,
                item.createdAt,
                item.updatedAt
            );
        });
        db.run("COMMIT", () => {
            console.log(`Migrados ${data.length} uniformes.`);
            stmt.finalize();
            cb();
        });
    });
}

function migrateFormularios(cb) {
    const filePath = path.join(__dirname, '..', 'form_questions.json');
    let data;
    try {
        if (fs.existsSync(filePath)) {
            data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (e) {
        console.error('Erro ao ler form_questions.json:', e);
    }

    if (!data || Object.keys(data).length === 0) return cb();

    const stmt = db.prepare(`INSERT OR REPLACE INTO formularios (id, titulo, tipo, questoes, ativo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`);

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        Object.keys(data).forEach(key => {
            const id = key.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            stmt.run(
                id,
                key, // titulo
                'avaliacao', // tipo
                JSON.stringify(data[key]),
                1, // ativo
                new Date().toISOString(),
                new Date().toISOString()
            );
        });
        db.run("COMMIT", () => {
            console.log(`Migrados ${Object.keys(data).length} formularios.`);
            stmt.finalize();
            cb();
        });
    });
}

function migrateFuncionarios(cb) {
    const data = readJSON('funcionarios.json');
    if (data.length === 0) return cb();
    
    const stmt = db.prepare(`INSERT OR REPLACE INTO funcionarios (id, nome, cpf, matricula, cargo, setor, data_admissao, nascimento, sexo, raca_cor, nacionalidade, tipo_vinculo, banco, agencia, conta, tipo_conta, chave_pix) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    
    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        data.forEach(item => {
            stmt.run(
                item.id,
                item.nome,
                item.cpf,
                item.matricula,
                item.cargo,
                item.setor,
                item.data_admissao || null,
                item.nascimento || null,
                item.sexo || null,
                item.raca_cor || null,
                item.nacionalidade || null,
                item.tipo_vinculo || null,
                item.banco,
                item.agencia,
                item.conta,
                item.tipo_conta,
                item.chave_pix
            );
        });
        db.run("COMMIT", () => {
            console.log(`Migrados ${data.length} funcionarios.`);
            stmt.finalize();
            cb();
        });
    });
}

function migrateSolicitacoes(cb) {
    const data = readJSON('solicitacoes.json');
    if (data.length === 0) return cb();

    const stmt = db.prepare(`INSERT OR REPLACE INTO solicitacoes_ferias (id, nome, setor, inicio, inicio2, tipo_gozo, decimo, gestor_email, nome_gestor, status, status_rh, sugestao_data, justificativa, assinatura, signature_token, signed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const histStmt = db.prepare(`INSERT INTO historico_solicitacoes (solicitacao_id, data, acao, ator, justificativa) VALUES (?, ?, ?, ?, ?)`);

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        data.forEach(item => {
            stmt.run(
                item.id,
                item.nome,
                item.setor,
                item.inicio,
                item.inicio2,
                item.tipoGozo,
                item.decimo,
                item.gestorEmail,
                item.nomeGestor,
                item.status,
                item.statusRH,
                item.sugestaoData,
                item.justificativa,
                item.assinatura,
                item.signatureToken,
                item.signedAt,
                item.createdAt,
                item.updatedAt
            );

            if (item.historico && Array.isArray(item.historico)) {
                item.historico.forEach(h => {
                    histStmt.run(item.id, h.data, h.acao, h.ator, h.justificativa);
                });
            }
        });
        db.run("COMMIT", () => {
            console.log(`Migrados ${data.length} solicitacoes.`);
            stmt.finalize();
            histStmt.finalize();
            cb();
        });
    });
}

function migrateTaxas(cb) {
    const data = readJSON('taxas.json');
    if (data.length === 0) return cb();

    const stmt = db.prepare(`INSERT OR REPLACE INTO taxas (id, nome_taxa, cpf, funcao, forma_pagamento, chave_pix, banco, agencia, conta, tipo_conta, departamento, motivo, antecessor, valores, status, email_gestor, email_solicitante, signature_token, assinatura, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        data.forEach(item => {
            stmt.run(
                item.id,
                item.nome_taxa,
                item.cpf,
                item.funcao,
                item.forma_pagamento,
                item.pix,
                item.banco,
                item.agencia,
                item.conta,
                item.tipo_conta,
                item.departamento,
                JSON.stringify(item.motivo),
                item.antecessor,
                JSON.stringify(item.valores),
                item.status,
                item.email_gestor,
                item.email_solicitante,
                item.signatureToken,
                item.assinatura,
                item.createdAt,
                item.updatedAt
            );
        });
        db.run("COMMIT", () => {
            console.log(`Migrados ${data.length} taxas.`);
            stmt.finalize();
            cb();
        });
    });
}

function migrateCandidatos(cb) {
    const data = readJSON('candidatos.json');
    if (data.length === 0) return cb();

    const stmt = db.prepare(`INSERT OR REPLACE INTO candidatos (id, nome, email, telefone, curriculo, status, observacao, data_entrevista, local_entrevista, entrevistador, created_at, historico) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        data.forEach(item => {
            stmt.run(
                item.id,
                item.nome,
                item.email,
                item.telefone,
                item.curriculo,
                item.status,
                item.observacao,
                item.data_entrevista,
                item.local_entrevista,
                item.entrevistador,
                item.createdAt,
                JSON.stringify(item.historico)
            );
        });
        db.run("COMMIT", () => {
            console.log(`Migrados ${data.length} candidatos.`);
            stmt.finalize();
            cb();
        });
    });
}

function migrateVagas(cb) {
    const data = readJSON('vagas.json');
    if (data.length === 0) return cb();

    const stmt = db.prepare(`INSERT OR REPLACE INTO vagas (id, titulo, descricao, requisitos, status, ativa, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`);

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        data.forEach(item => {
            stmt.run(
                item.id,
                item.titulo,
                item.descricao,
                item.requisitos,
                item.status,
                item.ativa ? 1 : 0,
                item.createdAt
            );
        });
        db.run("COMMIT", () => {
            console.log(`Migrados ${data.length} vagas.`);
            stmt.finalize();
            cb();
        });
    });
}

function migrateMovimentacoes(cb) {
    const data = readJSON('movimentacoes.json');
    if (data.length === 0) return cb();

    const stmt = db.prepare(`INSERT OR REPLACE INTO movimentacoes (id, nome_colaborador, setor, cargo, status, dados, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        data.forEach(item => {
            const { id, nome_colaborador, setor, cargo, status, createdAt, updatedAt, ...rest } = item;
            stmt.run(
                id,
                nome_colaborador,
                setor,
                cargo,
                status,
                JSON.stringify(rest),
                createdAt,
                updatedAt
            );
        });
        db.run("COMMIT", () => {
            console.log(`Migrados ${data.length} movimentacoes.`);
            stmt.finalize();
            cb();
        });
    });
}
