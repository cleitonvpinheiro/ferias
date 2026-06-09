const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database', 'formularios.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Adicionar coluna 'email_solicitante' na tabela solicitacoes_taxa
    db.run("ALTER TABLE solicitacoes_taxa ADD COLUMN email_solicitante TEXT", (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log("Coluna 'email_solicitante' já existe.");
            } else {
                console.error("Erro ao adicionar coluna 'email_solicitante':", err.message);
            }
        } else {
            console.log("Coluna 'email_solicitante' adicionada com sucesso na tabela solicitacoes_taxa.");
        }
    });
});

db.close();
