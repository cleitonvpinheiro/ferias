const ldap = require('ldapjs');
const fs = require('fs');

const getEnv = (k) => String(process.env[k] || '').trim();

// #region debug-point B:ldap-service
const __dbgLdap = (hypothesisId, msg, data = {}) => {
    try {
        const envRaw = fs.readFileSync('/home/administrador/projetos-nodejs/portal-formularios/.dbg/ldap-import-refused.env', 'utf8');
        const url = envRaw.match(/DEBUG_SERVER_URL=(.+)/)?.[1] || 'http://127.0.0.1:7777/event';
        const sessionId = envRaw.match(/DEBUG_SESSION_ID=(.+)/)?.[1] || 'ldap-import-refused';
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId,
                runId: 'pre-fix',
                hypothesisId,
                location: 'services/ldapService.js',
                msg: `[DEBUG] ${msg}`,
                data,
                ts: Date.now()
            })
        }).catch(() => {});
    } catch (_) {}
};
// #endregion

const escapeLdapFilterValue = (value) => {
    const s = String(value == null ? '' : value);
    return s
        .replace(/\\/g, '\\5c')
        .replace(/\*/g, '\\2a')
        .replace(/\(/g, '\\28')
        .replace(/\)/g, '\\29')
        .replace(/\0/g, '\\00');
};

const createClient = () => {
    const url = getEnv('LDAP_URL');
    const connectTimeout = Number(getEnv('LDAP_CONNECT_TIMEOUT_MS') || '5000');
    const timeout = Number(getEnv('LDAP_TIMEOUT_MS') || '10000');
    const rejectUnauthorized = getEnv('LDAP_TLS_REJECT_UNAUTHORIZED');
    const tlsReject = rejectUnauthorized === '' ? true : rejectUnauthorized !== '0';

    return ldap.createClient({
        url,
        connectTimeout: Number.isFinite(connectTimeout) ? connectTimeout : 5000,
        timeout: Number.isFinite(timeout) ? timeout : 10000,
        tlsOptions: { rejectUnauthorized: tlsReject }
    });
};

const bindAsync = (client, dn, password) =>
    new Promise((resolve, reject) =>
        client.bind(dn, password, (err) => (err ? reject(err) : resolve(true)))
    );

const searchOneAsync = (client, base, options) =>
    new Promise((resolve, reject) => {
        client.search(base, options, (err, res) => {
            if (err) return reject(err);
            let entry = null;
            res.on('searchEntry', (e) => { if (!entry) entry = e; });
            res.on('error', reject);
            res.on('end', () => resolve(entry));
        });
    });

/**
 * Authenticates a user against LDAP
 * @param {string} username 
 * @param {string} password 
 * @returns {Promise<{success: boolean, user?: any, error?: string}>}
 */
function authenticate(username, password) {
    return new Promise((resolve) => {
        const LDAP_URL = getEnv('LDAP_URL');
        const LDAP_DN_FORMAT = getEnv('LDAP_DN_FORMAT'); // e.g. "uid=%s,ou=users,dc=example,dc=com" or "DOMAIN\\%s" or "%s@domain"
        const bindMethod = (getEnv('LDAP_BIND_METHOD') || 'direct').toLowerCase(); // direct | search

        if (!LDAP_URL) {
            console.log('LDAP not configured (LDAP_URL missing)');
            return resolve({ success: false, error: 'LDAP not configured' });
        }

        const safeUsername = String(username || '').trim();
        const safePassword = String(password || '');

        if (!safeUsername || !safePassword) {
            return resolve({ success: false, error: 'Invalid credentials' });
        }

        const client = createClient();
        client.on('error', (err) => {
            console.error('LDAP Connection Error:', err);
            resolve({ success: false, error: 'Connection error' });
        });

        (async () => {
            try {
                const searchBase = getEnv('LDAP_SEARCH_BASE');
                const escaped = escapeLdapFilterValue(safeUsername);

                let userDN = null;
                if (bindMethod === 'search') {
                    const bindDN = getEnv('LDAP_ADMIN_DN');
                    const bindPass = getEnv('LDAP_ADMIN_PASSWORD');
                    const userSearchBase = getEnv('LDAP_USER_SEARCH_BASE') || searchBase;
                    const userSearchFilterRaw = getEnv('LDAP_USER_SEARCH_FILTER') || '(|(uid=%s)(sAMAccountName=%s)(userPrincipalName=%s))';

                    if (!bindDN || !bindPass || !userSearchBase) {
                        client.unbind();
                        return resolve({ success: false, error: 'LDAP not configured' });
                    }

                    await bindAsync(client, bindDN, bindPass);
                    const filter = userSearchFilterRaw.replaceAll('%s', escaped);
                    const entry = await searchOneAsync(client, userSearchBase, { filter, scope: 'sub', attributes: ['dn'] });
                    if (!entry || !entry.dn) {
                        client.unbind();
                        return resolve({ success: false, error: 'Invalid credentials' });
                    }
                    userDN = String(entry.dn || '').trim();

                    await bindAsync(client, userDN, safePassword);
                } else {
                    if (!LDAP_DN_FORMAT) {
                        client.unbind();
                        return resolve({ success: false, error: 'LDAP not configured' });
                    }
                    userDN = LDAP_DN_FORMAT.replace('%s', safeUsername);
                    await bindAsync(client, userDN, safePassword);
                }

                if (!searchBase) {
                    client.unbind();
                    return resolve({ success: true, user: { username: safeUsername } });
                }

                const userAttrFilterRaw = getEnv('LDAP_USER_ATTR_FILTER') || '(|(uid=%s)(sAMAccountName=%s)(userPrincipalName=%s))';
                const userAttrFilter = userAttrFilterRaw.replaceAll('%s', escaped);
                const attrs = (getEnv('LDAP_USER_ATTRIBUTES') || 'cn,displayName,mail,uid,sAMAccountName,userPrincipalName')
                    .split(',')
                    .map(s => s.trim())
                    .filter(Boolean);

                const entry = await searchOneAsync(client, searchBase, { filter: userAttrFilter, scope: 'sub', attributes: attrs });
                const obj = entry && entry.object ? entry.object : null;
                const name =
                    (obj && (obj.displayName || obj.cn)) ||
                    safeUsername;
                const email = obj && (obj.mail || obj.email) ? (obj.mail || obj.email) : undefined;

                client.unbind();
                return resolve({ success: true, user: { username: safeUsername, name, email } });
            } catch (err) {
                const msg = err && err.message ? String(err.message) : 'LDAP error';
                if (/InvalidCredentials|invalid credentials/i.test(msg)) {
                    try { client.unbind(); } catch (_) {}
                    return resolve({ success: false, error: 'Invalid credentials' });
                }
                console.error('LDAP Error:', err);
                try { client.unbind(); } catch (_) {}
                return resolve({ success: false, error: 'Connection error' });
            }
        })();
    });
}

/**
 * Searches for users in LDAP (Requires Admin Credentials)
 * @param {string} query 
 * @returns {Promise<Array>}
 */
function searchUsers(query = '*') {
    return new Promise((resolve, reject) => {
        // #region debug-point B:search-entry
        __dbgLdap('B', 'searchUsers entered', {
            query: String(query == null ? '' : query),
            hasUrl: !!getEnv('LDAP_URL'),
            hasBindDn: !!getEnv('LDAP_ADMIN_DN'),
            hasSearchBase: !!getEnv('LDAP_SEARCH_BASE')
        });
        // #endregion
        if (!getEnv('LDAP_URL')) return resolve([]);

        const client = createClient();
        let settled = false;
        const settleResolve = (val) => {
            if (settled) return;
            settled = true;
            resolve(val);
        };
        const settleReject = (err) => {
            if (settled) return;
            settled = true;
            reject(err);
        };
        client.on('error', (err) => {
            __dbgLdap('C', 'client error event', { message: err && err.message, code: err && err.code });
            try { client.unbind(); } catch (_) {}
            settleReject(err);
        });
        const bindDN = getEnv('LDAP_ADMIN_DN');
        const bindPass = getEnv('LDAP_ADMIN_PASSWORD');

        if (!bindDN || !bindPass) {
            console.warn('LDAP Admin credentials not set. Cannot search users.');
            return settleResolve([]);
        }

        client.bind(bindDN, bindPass, (err) => {
            if (err) {
                // #region debug-point C:bind-error
                __dbgLdap('C', 'admin bind failed', { message: err && err.message, code: err && err.code });
                // #endregion
                client.unbind();
                return settleReject(err);
            }
            // #region debug-point C:bind-ok
            __dbgLdap('C', 'admin bind ok', { bindDN });
            // #endregion

            const q = String(query == null ? '' : query).trim();
            const matchAll = !q || q === '*';
            const qEsc = escapeLdapFilterValue(q);
            const importBaseFilter = getEnv('LDAP_IMPORT_BASE_FILTER')
                || '(&(objectCategory=person)(objectClass=user))';
            const searchFilter = matchAll
                ? importBaseFilter
                : `(&${importBaseFilter}(|(uid=*${qEsc}*)(cn=*${qEsc}*)(sAMAccountName=*${qEsc}*)(userPrincipalName=*${qEsc}*)(displayName=*${qEsc}*)(mail=*${qEsc}*)))`;
            const searchOptions = {
                filter: searchFilter,
                scope: 'sub',
                attributes: ['uid', 'cn', 'displayName', 'mail', 'sAMAccountName', 'userPrincipalName']
            };

            const searchBase = getEnv('LDAP_SEARCH_BASE') || "dc=example,dc=com";
            // #region debug-point D:search-dispatch
            __dbgLdap('D', 'dispatching ldap search', { searchBase, matchAll, filter: searchFilter });
            // #endregion

            client.search(searchBase, searchOptions, (err, res) => {
                if (err) {
                    // #region debug-point D:search-call-error
                    __dbgLdap('D', 'client.search callback error', { message: err && err.message, code: err && err.code });
                    // #endregion
                    client.unbind();
                    return settleReject(err);
                }

                const users = [];

                const entryToObject = (entry) => {
                    if (!entry) return null;
                    if (entry.object && typeof entry.object === 'object') return entry.object;
                    const pojo = entry.pojo && typeof entry.pojo === 'object' ? entry.pojo : null;
                    const fromAttrs = (attrs, objectName) => {
                        if (!Array.isArray(attrs)) return null;
                        const out = {};
                        if (objectName) out.dn = String(objectName);
                        for (const a of attrs) {
                            if (!a) continue;
                            const type = a.type != null ? String(a.type) : '';
                            if (!type) continue;
                            const rawVals = Array.isArray(a.values) ? a.values : (Array.isArray(a.vals) ? a.vals : (a.value != null ? [a.value] : (a.vals != null ? [a.vals] : [])));
                            const vals = Array.isArray(rawVals) ? rawVals : [];
                            if (vals.length === 0) continue;
                            out[type] = vals.length === 1 ? vals[0] : vals;
                        }
                        return Object.keys(out).length > 0 ? out : null;
                    };
                    if (pojo && Array.isArray(pojo.attributes)) return fromAttrs(pojo.attributes, pojo.objectName);
                    if (Array.isArray(entry.attributes)) return fromAttrs(entry.attributes, entry.dn);
                    if (typeof entry.toObject === 'function') {
                        const o = entry.toObject();
                        if (o && typeof o === 'object') return o;
                    }
                    return null;
                };

                res.on('searchEntry', (entry) => {
                    users.push(entryToObject(entry));
                });

                res.on('error', (searchErr) => {
                    // #region debug-point E:search-stream-error
                    __dbgLdap('E', 'search stream error', { message: searchErr && searchErr.message, code: searchErr && searchErr.code });
                    // #endregion
                    client.unbind();
                    settleReject(searchErr);
                });

                res.on('end', () => {
                    // #region debug-point E:search-end
                    __dbgLdap('E', 'search stream end', { count: users.length });
                    // #endregion
                    client.unbind();
                    settleResolve(users);
                });
            });
        });
    });
}

module.exports = {
    authenticate,
    searchUsers
};
