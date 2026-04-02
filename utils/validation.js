const tiposGozoPermitidos = new Set(['20', '20+10', '30', '15+15']);

function validarPayloadFerias(p) {
  if (!p) return { ok: false, erro: 'Dados ausentes' };
  const { nome, setor, inicio, inicio2, tipoGozo, decimo, statusRH, sugestaoData, assinatura } = p;
  if (!nome || !setor || !inicio || !tipoGozo) return { ok: false, erro: 'Campos obrigatórios ausentes' };
  if (!tiposGozoPermitidos.has(String(tipoGozo))) return { ok: false, erro: 'Período de férias inválido' };
  const d = new Date(inicio);
  if (Number.isNaN(d.getTime())) return { ok: false, erro: 'Data inválida' };
  if (String(tipoGozo).includes('+') && tipoGozo !== '20+10') {
    if (!inicio2) return { ok: false, erro: 'Informe o segundo período' };
    const d2 = new Date(inicio2);
    if (Number.isNaN(d2.getTime())) return { ok: false, erro: 'Data do segundo período inválida' };
  }
  if (assinatura) {
    const hasBase64Prefix = typeof assinatura === 'string' && assinatura.startsWith('data:image/');
    if (!hasBase64Prefix) return { ok: false, erro: 'Assinatura inválida' };
  }
  return { ok: true };
}

function normalizeCpf(value) {
  if (value === null || value === undefined) return null;
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return null;
  return digits;
}

function isValidCpf(cpf) {
  const digits = normalizeCpf(cpf);
  if (!digits || digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const nums = digits.split('').map(n => Number(n));
  if (nums.some(n => Number.isNaN(n))) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += nums[i] * (10 - i);
  let dv1 = (sum * 10) % 11;
  if (dv1 === 10) dv1 = 0;
  if (dv1 !== nums[9]) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += nums[i] * (11 - i);
  let dv2 = (sum * 10) % 11;
  if (dv2 === 10) dv2 = 0;
  if (dv2 !== nums[10]) return false;

  return true;
}

module.exports = {
    validarPayloadFerias,
    normalizeCpf,
    isValidCpf
};
