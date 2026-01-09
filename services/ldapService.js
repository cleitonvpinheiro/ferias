const ldap = require('ldapjs');

const LDAP_URL = process.env.LDAP_URL;
const LDAP_DN_FORMAT = process.env.LDAP_DN_FORMAT; // e.g. "uid=%s,ou=users,dc=example,dc=com" or "DOMAIN\\%s"

/**
 * Authenticates a user against LDAP
 * @param {string} username 
 * @param {string} password 
 * @returns {Promise<{success: boolean, user?: any, error?: string}>}
 */
function authenticate(username, password) {
    return new Promise((resolve, reject) => {
        if (!LDAP_URL || !LDAP_DN_FORMAT) {
            console.log('LDAP not configured (LDAP_URL or LDAP_DN_FORMAT missing)');
            return resolve({ success: false, error: 'LDAP not configured' });
        }

        const client = ldap.createClient({
            url: LDAP_URL
        });

        client.on('error', (err) => {
            console.error('LDAP Connection Error:', err);
            resolve({ success: false, error: 'Connection error' });
        });

        // Replace %s with username in the DN format
        const userDN = LDAP_DN_FORMAT.replace('%s', username);

        client.bind(userDN, password, (err) => {
            if (err) {
                console.log('LDAP Bind Error:', err.message);
                client.unbind();
                return resolve({ success: false, error: 'Invalid credentials' });
            }

            // Authentication successful
            // You could search for user details here if needed
            
            client.unbind();
            resolve({ success: true, user: { username } });
        });
    });
}

module.exports = {
    authenticate
};
