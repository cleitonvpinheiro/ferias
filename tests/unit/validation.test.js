const { isValidCpf, normalizeCpf } = require('../../utils/validation');

describe('Validation Utility', () => {
    test('should normalize CPF removing non-digits', () => {
        expect(normalizeCpf('123.456.789-00')).toBe('12345678900');
        expect(normalizeCpf('  123 456 789 00 ')).toBe('12345678900');
        expect(normalizeCpf(null)).toBe(null);
    });

    test('should validate correct CPF', () => {
        // CPF válido gerado (exemplo)
        expect(isValidCpf('07983181981')).toBe(true); 
    });

    test('should invalidate wrong CPF', () => {
        expect(isValidCpf('11111111111')).toBe(false);
        expect(isValidCpf('12345678900')).toBe(false);
        expect(isValidCpf('abc')).toBe(false);
    });
});
