const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'database', 'formularios.db');
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
    console.log('Criando tabela solicitacoes_taxa...');
    db.run(`CREATE TABLE IF NOT EXISTS solicitacoes_taxa (
        id TEXT PRIMARY KEY,
        solicitante TEXT,
        departamento TEXT,
        funcao_necessaria TEXT,
        motivo TEXT,
        detalhe_motivo TEXT,
        data_necessaria TEXT,
        horario_inicio TEXT,
        horario_fim TEXT,
        quantidade_vagas INTEGER,
        observacoes TEXT,
        status TEXT DEFAULT 'pendente',
        created_at TEXT,
        updated_at TEXT
    )`, (err) => {
        if (err) console.error('Erro ao criar tabela:', err.message);
        else console.log('Tabela solicitacoes_taxa criada/verificada com sucesso.');
    });
});
