const ldapService = require('../services/ldapService');
const db = require('../services/db');
const crypto = require('crypto');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

(async () => {
    try {
        if (!process.env.LDAP_URL) {
            console.error('LDAP_URL not defined in .env');
            process.exit(1);
        }

        console.log('Connecting to LDAP...');
        const users = await ldapService.searchUsers('*');
        console.log(`Found ${users.length} users in LDAP.`);

        let importedCount = 0;
        for (const u of users) {
            // Determine username field (AD vs OpenLDAP)
            const username = u.uid || u.sAMAccountName || u.cn;
            
            if (!username) {
                console.warn('Skipping user without username (uid/sAMAccountName/cn):', u);
                continue;
            }

            // Check if exists
            const exists = await db.users.getByUsername(username);
            if (exists) {
                console.log(`User ${username} already exists. Skipping.`);
                continue;
            }

            const newUser = {
                username,
                password: crypto.randomBytes(16).toString('hex'), // Random password
                role: 'rh_geral', // Default role
                name: u.displayName || u.cn || username
            };

            await db.users.create(newUser);
            console.log(`Imported ${username} (${newUser.name})`);
            importedCount++;
        }
        
        console.log(`Import completed. Imported ${importedCount} new users.`);
    } catch (e) {
        console.error('Import failed:', e);
    }
})();
