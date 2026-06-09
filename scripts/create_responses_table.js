const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, '..', 'database', 'formularios.db');

const db = new sqlite3.Database(DB_PATH);

const createTableSql = `
CREATE TABLE IF NOT EXISTS respostas_formularios (
    id TEXT PRIMARY KEY,
    formulario_id TEXT NOT NULL,
    funcionario_id INTEGER,
    respostas TEXT,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY(formulario_id) REFERENCES formularios(id),
    FOREIGN KEY(funcionario_id) REFERENCES funcionarios(id)
);
`;

db.serialize(() => {
    db.run(createTableSql, (err) => {
        if (err) {
            console.error('Erro ao criar tabela respostas_formularios:', err.message);
        } else {
            console.log('Tabela respostas_formularios criada com sucesso.');
        }
    });
});

db.close();
