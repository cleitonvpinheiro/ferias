# [OPEN] Debug Session: ldap-import-refused

## Sintoma
- Ao clicar em `Importar LDAP` em `gerenciar-usuarios.html`, o navegador mostra `Failed to fetch` com `net::ERR_CONNECTION_REFUSED`.

## Contexto
- Aplicacao Node/Express em producao via PM2.
- Importacao LDAP chama `POST /api/users/import-ldap`.
- O erro ocorre no browser durante a tentativa de importacao.

## Hipoteses
1. O processo `portal-formularios` cai durante a chamada de importacao LDAP, e a conexao do browser e recusada na sequencia.
2. A importacao dispara uma excecao nao tratada no `ldapjs`, encerrando o processo Node antes de responder HTTP.
3. O PM2 sobe a aplicacao, mas ela reinicia ao tentar bind/search no AD por causa de erro de TLS/LDAPS (`ECONNRESET`).
4. O browser esta chamando uma origem/porta incorreta ou uma instancia antiga, e por isso recebe `ERR_CONNECTION_REFUSED`.
5. A rota responde lentamente, a pagina dispara nova tentativa/reload e o erro percebido no console mascara um crash no backend.

## Plano de Evidencia
- Confirmar status do PM2 antes e depois da reproducao.
- Capturar logs de `out` e `error` imediatamente apos a tentativa de importacao.
- Instrumentar apenas pontos de entrada/saida da importacao LDAP e do servico LDAP, sem alterar regra de negocio.
- Correlacionar tentativa no browser com eventual restart/crash do processo.
