# SinalTech — Contraturno

Requer Node.js 18 ou superior.

## Executar

Na pasta `sinal`, execute:

```powershell
npm install
npm start
```

Abra http://localhost:3000. O backend serve a pasta irmã `public` e usa exclusivamente `sinal/data/horarios.json` para ler e salvar os horários. Não é necessário iniciar um segundo servidor para o front.

Clique em **Ativar som e iniciar** para liberar o áudio no navegador. Mantenha a página aberta e o computador ligado, com o relógio local correto. Os áudios são reproduzidos pelo navegador, na máquina que abriu o painel.

## Horários

O JSON usa os dias `monday`, `tuesday`, `wednesday`, `thursday`, `friday`, combinados com `_morning` ou `_afternoon`. Cada lista contém `time` (`HH:mm`), `name`, `music` (nome de um MP3 em `public/assets/audio`) e `duration` (segundos).

O painel permite consultar qualquer dia e turno. Os sinais automáticos seguem o dia atual e consideram ambos os turnos, inclusive os horários sobrepostos. Aos sábados e domingos não há sinais. Depois do último sinal, o contador mostra o próximo dia com horários.

Em **Configurações** é possível criar, editar ou remover horários por dia e turno. O painel integrado atualiza imediatamente após salvar; outras abas e alterações manuais no JSON são consultadas a cada 30 segundos. A página administrativa separada continua em `/config.html`.

A API permanece em `GET/PUT /api/schedule` e `DELETE /api/schedule/:dia/:hora`. Ao hospedar o front separadamente, encaminhe `/api` ao backend no mesmo domínio. O antigo endereço fixo do Render foi removido.

## Verificar

```powershell
npm test
```

Os testes de gravação usam cópias temporárias e preservam os horários reais.
