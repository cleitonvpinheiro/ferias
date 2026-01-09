const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'database', 'formularios.db');
const db = new sqlite3.Database(DB_PATH);

db.all("SELECT * FROM avaliacoes WHERE tipo = 'experiencia'", (err, rows) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log(`Encontradas ${rows.length} avaliações de experiência.`);
    if (rows.length > 0) {
        console.log('Exemplo do primeiro registro:', rows[0]);
    } else {
        console.log('Nenhum registro encontrado ainda.');
    }
});
