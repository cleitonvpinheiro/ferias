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

            // Authentication successful. Now fetch user details.
            const searchOptions = {
                filter: `(uid=${username})`, // Adjust filter based on schema
                scope: 'sub',
                attributes: ['cn', 'displayName', 'mail', 'uid']
            };
            
            // If DN format uses something else than uid, we might need to adjust the filter.
            // But since we constructed DN from username, we can try to search by that username.
            // Alternatively, we can read the entry directly if we knew the base, but search is safer.
            
            // However, since we don't know the exact base for search (DN might be constructed),
            // let's try to infer base from DN or use a configured search base.
            // If LDAP_SEARCH_BASE is not set, we might fail to find attributes, but auth is still good.
            
            const searchBase = process.env.LDAP_SEARCH_BASE || "dc=example,dc=com"; // Fallback or env

            client.search(searchBase, searchOptions, (err, res) => {
                if (err) {
                    console.error('LDAP Search Error:', err);
                    client.unbind();
                    // Return success but with limited info
                    return resolve({ success: true, user: { username } });
                }

                let userEntry = { username };

                res.on('searchEntry', (entry) => {
                    const obj = entry.object;
                    userEntry.name = obj.displayName || obj.cn || username;
                    userEntry.email = obj.mail;
                });

                res.on('error', (err) => {
                    console.error('LDAP Search Entry Error:', err);
                });

                res.on('end', (result) => {
                    client.unbind();
                    resolve({ success: true, user: userEntry });
                });
            });
        });
    });
}

/**
 * Searches for users in LDAP (Requires Admin Credentials)
 * @param {string} query 
 * @returns {Promise<Array>}
 */
function searchUsers(query = '*') {
    return new Promise((resolve, reject) => {
        if (!process.env.LDAP_URL) return resolve([]);

        const client = ldap.createClient({ url: process.env.LDAP_URL });
        const bindDN = process.env.LDAP_ADMIN_DN;
        const bindPass = process.env.LDAP_ADMIN_PASSWORD;

        if (!bindDN || !bindPass) {
            console.warn('LDAP Admin credentials not set. Cannot search users.');
            return resolve([]);
        }

        client.bind(bindDN, bindPass, (err) => {
            if (err) {
                client.unbind();
                return reject(err);
            }

            const searchOptions = {
                filter: `(&(objectClass=person)(|(uid=*${query}*)(cn=*${query}*)))`,
                scope: 'sub',
                attributes: ['uid', 'cn', 'displayName', 'mail', 'sAMAccountName']
            };

            const searchBase = process.env.LDAP_SEARCH_BASE || "dc=example,dc=com";

            client.search(searchBase, searchOptions, (err, res) => {
                if (err) {
                    client.unbind();
                    return reject(err);
                }

                const users = [];

                res.on('searchEntry', (entry) => {
                    users.push(entry.object);
                });

                res.on('end', () => {
                    client.unbind();
                    resolve(users);
                });
            });
        });
    });
}

module.exports = {
    authenticate,
    searchUsers
};
