const CryptoJS = require('crypto-js');
require('dotenv').config();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'madalosso-secret-key-2026';

const encrypt = (text) => {
    if (!text) return text;
    try {
        return CryptoJS.AES.encrypt(String(text), ENCRYPTION_KEY).toString();
    } catch (e) {
        console.error('Encryption error:', e);
        return text;
    }
};

const decrypt = (hash) => {
    if (!hash) return hash;
    try {
        const bytes = CryptoJS.AES.decrypt(hash, ENCRYPTION_KEY);
        const originalText = bytes.toString(CryptoJS.enc.Utf8);
        return originalText || hash;
    } catch (e) {
        // Se não conseguir descriptografar, assume que não está criptografado (compatibilidade legada)
        return hash;
    }
};

module.exports = { encrypt, decrypt };
