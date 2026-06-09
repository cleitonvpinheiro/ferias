// reset_total.js
'use strict';
require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
    const pool = mysql.createPool({
        host: process.env.MYSQL_HOST || 'localhost',
        port: Number(process.env.MYSQL_PORT || 3306),
        user: process.env.MYSQL_USER || process.env.MYSQL_USERNAME,
        password: process.env.MYSQL_PASS || process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DB || process.env.MYSQL_NAME || process.env.MYSQL_DATABASE,
    });

    console.log('Iniciando reset total...');

    const tabelas = [
        'avaliacao_assinaturas',
        'avaliacao_consolidado',
        'avaliacao_participantes',
        'avaliacao_ciclos',
        'avaliacoes',
    ];

    for (const tabela of tabelas) {
        try {
            const [r] = await pool.execute(`DELETE FROM ${tabela}`);
            console.log(`✅ ${tabela}: ${r.affectedRows} registros removidos`);
        } catch (e) {
            console.log(`⚠️  ${tabela}: ${e.message}`);
        }
    }

    await pool.end();
    console.log('Reset concluído. Funcionários e usuários preservados.');
    process.exit(0);
})();