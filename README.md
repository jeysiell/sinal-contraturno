# Sinal do Contraturno

Painel e backend do sinal escolar, publicados juntos no Render.

## Estrutura

- `public/`: interface, configurações e áudios.
- `sinal/`: API Express, testes e dependências.
- `sinal/data/horarios.json`: horários por dia da semana e turno.
- `render.yaml`: configuração do serviço gratuito no Render.

## Executar localmente

Requer Node.js 24.

```sh
npm ci --prefix sinal
npm test
npm start
```

Abra http://localhost:3000. Clique em **Ativar som e iniciar** e mantenha o navegador aberto no computador que deve reproduzir os sinais.

## Publicar no Render

Conecte este repositório como um Web Service Node.js, branch `main`:

- Build: `npm ci --prefix sinal && npm test --prefix sinal`
- Start: `npm start`
- Health check: `/api/schedule`
- Instance: Free

O front usa a API no mesmo domínio. Os horários carregados são os de `sinal/data/horarios.json`. Edições feitas na interface alteram esse arquivo no servidor.

O plano gratuito do Render usa armazenamento temporário: alterações feitas no JSON pela interface são perdidas em reinícios ou novos deploys. Para horários permanentes no plano gratuito, atualize o JSON neste repositório e publique novamente. Para persistir edições da interface, é necessário armazenamento persistente; nenhum serviço pago é configurado por este projeto.

O plano gratuito também suspende o servidor por inatividade, podendo atrasar o primeiro carregamento. A página consulta os horários a cada 30 segundos e toca os áudios no navegador, seguindo o relógio local do computador.

Detalhes da API e do formato do JSON estão em `sinal/README.md`.
