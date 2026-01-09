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

module.exports = {
    validarPayloadFerias
};
