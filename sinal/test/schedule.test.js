const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { once } = require('node:events');
const { createApp } = require('../server');
const helpers = require('../../public/config/js/schedule');
const fixturePath = path.join(__dirname, '../data/horarios.json');

async function setup(t) {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'sinal-test-'));
  const file = path.join(folder, 'horarios.json');
  await fs.copyFile(fixturePath, file);
  const server = createApp({ scheduleFilePath: file }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await fs.rm(folder, { recursive: true, force: true });
  });
  const url = `http://127.0.0.1:${server.address().port}`;
  return { file, url, api: `${url}/api/schedule` };
}

test('API lê horarios.json e serve o front e os áudios', async t => {
  const { api, url } = await setup(t);
  const response = await fetch(api);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), JSON.parse(await fs.readFile(fixturePath, 'utf8')));
  for (const file of ['/', '/config.html', '/config/js/schedule.js', '/config/js/schedule-editor.js', '/assets/audio/musica1.mp3']) {
    const response = await fetch(url + file);
    assert.equal(response.status, 200, file);
    await response.arrayBuffer();
  }
});

test('editar, adicionar e excluir persistem apenas no dia e turno escolhido', async t => {
  const { api, file } = await setup(t);
  const data = await (await fetch(api)).json();
  const friday = structuredClone(data.friday_afternoon);
  data.monday_morning[0].duration = 20;
  data.monday_morning.push({ time: '11:10', name: 'Teste', music: 'sino.mp3', duration: 12 });
  const response = await fetch(api, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(await fs.readFile(file, 'utf8')), data);
  assert.equal((await fetch(`${api}/monday_morning/11%3A10`, { method: 'DELETE' })).status, 200);
  const saved = await (await fetch(api)).json();
  assert.equal(saved.monday_morning[0].duration, 20);
  assert.equal(saved.monday_morning.some(signal => signal.time === '11:10'), false);
  assert.deepEqual(saved.friday_afternoon, friday);
  assert.equal((await fetch(`${api}/monday_morning/11%3A10`, { method: 'DELETE' })).status, 404);
});

test('rejeita dados inválidos e duplicados sem alterar o arquivo', async t => {
  const { api, file } = await setup(t);
  const original = await fs.readFile(file, 'utf8');
  const data = JSON.parse(original);
  const signal = data.monday_morning[0];
  const invalid = [null, [], { morning: [] }, { monday_morning: {} },
    { monday_morning: [{ ...signal, time: '25:00' }] },
    { monday_morning: [{ ...signal, duration: -1 }] },
    { monday_morning: [{ ...signal, music: '../musica1.mp3' }] },
    { monday_morning: [signal, signal] }];
  for (const body of invalid) {
    assert.equal((await fetch(api, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).status, 400);
  }
  const malformed = await fetch(api, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(malformed.status, 400);
  assert.ok((await malformed.json()).error);
  assert.equal(await fs.readFile(file, 'utf8'), original);
});

test('JSON corrompido retorna erro sem derrubar o servidor', async t => {
  const { api, file } = await setup(t);
  await fs.writeFile(file, '{');
  const response = await fetch(api);
  assert.equal(response.status, 500);
  assert.ok((await response.json()).error.includes('horarios.json'));
  await fs.copyFile(fixturePath, file);
  assert.equal((await fetch(api)).status, 200);
});

test('exclusões simultâneas não perdem alterações', async t => {
  const { api } = await setup(t);
  const results = await Promise.all(['07:20', '08:10'].map(time =>
    fetch(`${api}/monday_morning/${encodeURIComponent(time)}`, { method: 'DELETE' })));
  assert.ok(results.every(response => response.ok));
  const saved = await (await fetch(api)).json();
  assert.ok(saved.monday_morning.every(signal => !['07:20', '08:10'].includes(signal.time)));
});

test('seleciona os horários do dia, incluindo sobreposição dos turnos e sexta', async () => {
  const data = JSON.parse(await fs.readFile(fixturePath, 'utf8'));
  const monday = helpers.signalsForDate(data, new Date(2026, 9, 19, 12, 0));
  assert.equal(monday.length, 15);
  assert.deepEqual(monday.filter(signal => signal.time >= '12:00' && signal.time <= '13:00').map(signal => signal.time), ['12:10', '12:30', '12:50']);
  const friday = helpers.signalsForDate(data, new Date(2026, 9, 23));
  assert.equal(friday.length, 14);
  assert.equal(friday.at(-1).time, '17:00');
  assert.equal(friday.at(-1).name, 'Fim das atividades (tarde)');
  assert.equal(helpers.signalsForDate(data, new Date(2026, 9, 24)).length, 0);
  assert.equal(helpers.signalsForDate(data, new Date(2026, 9, 25)).length, 0);
  assert.equal(helpers.currentPeriod(new Date(2026, 9, 23, 14)), 'friday_afternoon');
});

test('próximo sinal avança ao próximo dia e pula o fim de semana', async () => {
  const data = JSON.parse(await fs.readFile(fixturePath, 'utf8'));
  const next = helpers.nextSignal(data, new Date(2026, 9, 23, 17, 1));
  assert.equal(next.period, 'monday_morning');
  assert.equal(next.date.getDate(), 26);
  assert.equal(next.time, '07:20');
  assert.equal(helpers.nextSignal({}, new Date()), null);
  const tuesday = helpers.nextSignal(data, new Date(2026, 9, 19, 23, 59));
  assert.equal(tuesday.period, 'tuesday_morning');
});

test('agendador toca uma vez, respeita sexta e troca de dia sem recarregar', async () => {
  let now = new Date(2026, 9, 23, 16, 59, 59);
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now.getTime()])); }
  }
  const elements = new Map();
  const getElement = id => {
    if (!elements.has(id)) elements.set(id, { textContent: '', value: '', innerHTML: '', classList: { add() {}, remove() {} } });
    return elements.get(id);
  };
  const calls = [];
  const context = vm.createContext({
    window: { SinalSchedule: helpers }, Date: Clock, console,
    document: { getElementById: getElement, addEventListener() {} },
    setTimeout() {}, clearTimeout() {},
  });
  await vm.runInContext(await fs.readFile(path.join(__dirname, '../../public/config/js/index.js'), 'utf8'), context);
  context.data = JSON.parse(await fs.readFile(fixturePath, 'utf8'));
  context.record = (...args) => calls.push(args);
  vm.runInContext('schedule = data; initAudio = record;', context);
  now = new Date(2026, 9, 23, 17, 0, 0, 400);
  vm.runInContext('schedulerTick(); schedulerTick();', context);
  assert.deepEqual(calls, [['minha-vida-viagem-refrao.mp3', 12]]);
  now = new Date(2026, 9, 24, 0, 0);
  vm.runInContext('schedulerTick()', context);
  assert.equal(getElement('currentSignalTime').textContent, '--:--');
  assert.equal(getElement('nextSignalTime').textContent, '07:20');
  now = new Date(2026, 9, 26, 7, 19, 59);
  vm.runInContext('schedulerTick()', context);
  now = new Date(2026, 9, 26, 7, 20, 0, 200);
  vm.runInContext('schedulerTick()', context);
  assert.equal(calls.length, 2);
});
