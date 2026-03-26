const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'database', 'formularios.db');
const db = new sqlite3.Database(DB_PATH);

const run = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
    });
});

const setupAuth = async () => {
    console.log('Configurando autenticação...');

    // 1. Create Users Table
    await run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL,
            name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    console.log('Tabela users verificada/criada.');

    // 2. Default Users
    const users = [
        { username: 'admin', role: 'admin', name: 'Administrador' },
        { username: 'rh', role: 'rh_geral', name: 'RH Geral' },
        { username: 'dp', role: 'dp', name: 'Departamento Pessoal' },
        { username: 'recrutamento', role: 'recrutamento', name: 'Recrutamento e Seleção' },
        { username: 'td', role: 'td', name: 'Treinamento e Desenv.' },
        { username: 'sesmt', role: 'sesmt', name: 'SESMT' },
        { username: 'portaria', role: 'portaria', name: 'Portaria' },
        { username: 'gestor', role: 'gestor', name: 'Gestor Padrão' }
        ,
        { username: 'endomkt', role: 'endomarketing', name: 'Endomarketing' }
    ];

    const defaultPass = '123456';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(defaultPass, salt);

    for (const u of users) {
        try {
            await run(
                `INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)`,
                [u.username, hash, u.role, u.name]
            );
            console.log(`Usuário criado: ${u.username} (${u.role})`);
        } catch (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                console.log(`Usuário ${u.username} já existe.`);
                // Update password/role just in case
                await run(
                    `UPDATE users SET password = ?, role = ?, name = ? WHERE username = ?`,
                    [hash, u.role, u.name, u.username]
                );
            } else {
                console.error(`Erro ao criar ${u.username}:`, err.message);
            }
        }
    }

    console.log('Configuração de autenticação concluída.');
    db.close();
};

setupAuth();
