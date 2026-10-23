(function (root) {
  'use strict';
  const days = {
    monday: 'Segunda-feira', tuesday: 'Terça-feira', wednesday: 'Quarta-feira',
    thursday: 'Quinta-feira', friday: 'Sexta-feira',
  };
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const periods = Object.fromEntries(Object.entries(days).flatMap(([day, label]) => [
    [`${day}_morning`, `${label} — Manhã`], [`${day}_afternoon`, `${label} — Tarde`],
  ]));
  const musicLabels = {
    'sino.mp3': 'Sino padrão', 'musica1.mp3': 'Tu Me Sondas',
    'musica2.mp3': 'Eu Amo Minha Escola', 'musica3.mp3': 'My Lighthouse',
    'musica4.mp3': 'Amor Teimoso', 'musica5.mp3': 'Minha vida é uma viagem',
    'musica6.mp3': 'A Bíblia',
  };
  const apiUrl = root.location?.protocol === 'file:'
    ? 'http://localhost:3000/api/schedule' : '/api/schedule';
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g,
    char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

  function signalsForDate(schedule, now = new Date()) {
    const day = dayNames[now.getDay()];
    return ['morning', 'afternoon'].flatMap(turn => {
      const period = `${day}_${turn}`;
      return (schedule[period] || []).map(signal => {
        const [hour, minute] = signal.time.split(':').map(Number);
        const date = new Date(now);
        date.setHours(hour, minute, 0, 0);
        return { ...signal, period, date };
      });
    }).sort((a, b) => a.date - b.date);
  }

  function nextSignal(schedule, now = new Date()) {
    for (let offset = 0; offset <= 7; offset++) {
      const date = new Date(now);
      date.setDate(date.getDate() + offset);
      const next = signalsForDate(schedule, date).find(signal => signal.date > now);
      if (next) return next;
    }
    return null;
  }

  function currentPeriod(now = new Date()) {
    const day = days[dayNames[now.getDay()]] ? dayNames[now.getDay()] : 'monday';
    return `${day}_${now.getHours() < 12 ? 'morning' : 'afternoon'}`;
  }

  function populatePeriods(select, all = false) {
    if (!select) return;
    select.innerHTML = (all ? '<option value="all">Todos os dias e turnos</option>' : '') +
      Object.entries(periods).map(([key, label]) => `<option value="${key}">${label}</option>`).join('');
  }

  async function request(suffix = '', options = {}) {
    const response = await root.fetch(apiUrl + suffix, { cache: 'no-store', ...options });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Não foi possível acessar os horários.');
    return data;
  }

  const api = { periods, musicLabels, escapeHtml, signalsForDate, nextSignal, currentPeriod, populatePeriods, request };
  root.SinalSchedule = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
