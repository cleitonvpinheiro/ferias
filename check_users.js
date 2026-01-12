const db = require('./services/db');

(async () => {
    try {
        const users = await db.users.getAll();
        console.log('Users found:', users.length);
        users.forEach(u => console.log(`- ${u.username} (${u.role})`));
    } catch (e) {
        console.error('Error checking users:', e);
    }
})();
