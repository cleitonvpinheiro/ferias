const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'database', 'formularios.db');
const db = new sqlite3.Database(DB_PATH);

db.all("PRAGMA table_info(funcionarios)", (err, rows) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log('Columns in funcionarios:', rows.map(r => r.name));
    
    // Check for conta
    const hasConta = rows.some(r => r.name === 'conta');
    console.log('Has conta column:', hasConta);
});
