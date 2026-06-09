const { encrypt, decrypt } = require('../../utils/crypto');

describe('Crypto Utility', () => {
    test('should encrypt and decrypt correctly', () => {
        const text = '079.831.819-81';
        const encrypted = encrypt(text);
        expect(encrypted).not.toBe(text);
        
        const decrypted = decrypt(encrypted);
        expect(decrypted).toBe(text);
    });

    test('should return original value if decryption fails (legacy compatibility)', () => {
        const plainText = 'not-encrypted';
        const result = decrypt(plainText);
        expect(result).toBe(plainText);
    });

    test('should handle null/undefined', () => {
        expect(encrypt(null)).toBe(null);
        expect(decrypt(undefined)).toBe(undefined);
    });
});
