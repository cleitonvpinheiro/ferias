const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'database', 'formularios.db');
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
    console.log('Verificando tabela taxas...');
    db.get("SELECT detalhe_motivo FROM taxas LIMIT 1", (err, row) => {
        if (err) {
            if (err.message.includes('no such column')) {
                console.log('Adicionando coluna detalhe_motivo...');
                db.run("ALTER TABLE taxas ADD COLUMN detalhe_motivo TEXT", (err) => {
                    if (err) console.error('Erro ao adicionar coluna:', err.message);
                    else console.log('Coluna detalhe_motivo adicionada com sucesso.');
                });
            } else {
                console.error('Erro ao verificar coluna:', err.message);
            }
        } else {
            console.log('Coluna detalhe_motivo já existe.');
        }
    });
});
