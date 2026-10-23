const { periods, musicLabels, escapeHtml, signalsForDate, nextSignal, currentPeriod, populatePeriods, request } = window.SinalSchedule;
let schedule = {};
let selectedPeriod = currentPeriod();
let schedulerDay = new Date().toDateString();
let lastCheck = new Date();
const played = new Set();
let audioContext;
let currentAudio;
let loading = false;

const setText = (id, value) => {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
};

function renderSchedule() {
  const tbody = document.getElementById('scheduleTable');
  if (!tbody) return;
  setText('currentPeriodName', periods[selectedPeriod]);
  const search = document.getElementById('searchSignal')?.value.toLocaleLowerCase('pt-BR') || '';
  const signals = (schedule[selectedPeriod] || []).filter(signal =>
    signal.name.toLocaleLowerCase('pt-BR').includes(search)).sort((a, b) => a.time.localeCompare(b.time));
  tbody.innerHTML = signals.map((signal, index) => `
    <tr id="row-${selectedPeriod}-${signal.time.replace(':', '-')}" class="${index % 2 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800'}">
      <td class="py-3 px-4 text-center"><i class="fas fa-volume-up playing-icon"></i></td>
      <td class="py-3 px-4 font-bold">${escapeHtml(signal.time)}</td>
      <td class="py-3 px-4 font-medium">${escapeHtml(signal.name)}</td>
      <td class="py-3 px-4 text-slate-500">${escapeHtml(musicLabels[signal.music] || signal.music)}</td>
      <td class="py-3 px-4">${signal.duration}s</td>
    </tr>`).join('') || '<tr><td colspan="5" class="py-6 text-center">Nenhum sinal neste dia e turno.</td></tr>';
}

async function loadSchedule() {
  if (loading) return;
  loading = true;
  try {
    const data = await request();
    const changed = JSON.stringify(data) !== JSON.stringify(schedule);
    schedule = data;
    if (changed) renderSchedule();
    return true;
  } catch (error) {
    console.error(error);
    setText('audioStatus', `Erro ao atualizar horários: ${error.message}`);
    return false;
  } finally { loading = false; }
}

function unlockAudio() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return Promise.reject(new Error('Este navegador não oferece suporte ao áudio.'));
  if (!audioContext || audioContext.state === 'closed') audioContext = new AudioContext();
  return audioContext.resume();
}

async function initAudio(music = window.SinalSchedule.defaultMusic, duration = 12) {
  try {
    await unlockAudio();
    if (audioContext.state !== 'running') throw new Error('Clique em Ativar som e iniciar para liberar o áudio.');
    currentAudio?.stop();
    const audio = new Audio(`./assets/audio/${encodeURIComponent(music)}`);
    const source = audioContext.createMediaElementSource(audio);
    const gain = audioContext.createGain();
    source.connect(gain);
    gain.connect(audioContext.destination);
    let stopped = false;
    let timeout;
    const playback = { stop() {
      if (stopped) return;
      stopped = true;
      clearTimeout(timeout);
      audio.pause();
      source.disconnect();
      gain.disconnect();
      if (currentAudio === playback) currentAudio = null;
    } };
    currentAudio = playback;
    audio.onended = playback.stop;
    audio.onerror = () => {
      playback.stop();
      setText('audioStatus', `Erro ao carregar a música ${music}.`);
    };
    try { await audio.play(); } catch (error) { playback.stop(); throw error; }
    const now = audioContext.currentTime;
    gain.gain.setValueAtTime(0.9, now);
    gain.gain.setValueAtTime(0.9, now + Math.max(0, duration - 1));
    gain.gain.linearRampToValueAtTime(0, now + duration);
    timeout = setTimeout(playback.stop, duration * 1000);
    setText('audioStatus', 'Som ativado. Mantenha esta página aberta para os sinais automáticos.');
    return true;
  } catch (error) {
    console.error('Erro de áudio:', error);
    setText('audioStatus', `Não foi possível tocar: ${error.message}`);
    return false;
  }
}

function schedulerTick() {
  const now = new Date();
  if (schedulerDay !== now.toDateString()) {
    schedulerDay = now.toDateString();
    played.clear();
    selectedPeriod = currentPeriod(now);
    document.getElementById('periodFilter').value = selectedPeriod;
    renderSchedule();
  }
  const today = signalsForDate(schedule, now);
  // Tolera pequenos atrasos sem tocar sinais antigos após suspensão do computador.
  for (const signal of today) {
    const id = `${signal.period}-${signal.time}`;
    if (signal.date > lastCheck && signal.date <= now && now - signal.date < 5000 && !played.has(id)) {
      played.add(id);
      const row = document.getElementById(`row-${signal.period}-${signal.time.replace(':', '-')}`);
      row?.classList.add('row-playing');
      setTimeout(() => row?.classList.remove('row-playing'), signal.duration * 1000);
      initAudio(signal.music, signal.duration);
    }
  }
  lastCheck = now;
  const current = today.filter(signal => signal.date <= now).at(-1);
  const next = nextSignal(schedule, now);
  setText('currentSignalTime', current?.time || '--:--');
  setText('currentSignalName', current?.name || 'Nenhum sinal hoje');
  setText('nextSignalTime', next?.time || '--:--');
  const nextDay = next && next.date.toDateString() !== now.toDateString()
    ? `${next.date.toLocaleDateString('pt-BR', { weekday: 'long' })}: ` : '';
  setText('nextSignalName', next ? nextDay + next.name : 'Nenhum sinal programado');
  const seconds = next ? Math.max(0, Math.ceil((next.date - now) / 1000)) : null;
  setText('countdown', seconds === null ? '--:--' :
    `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`);
  setText('currentTime', now.toLocaleTimeString('pt-BR'));
}

async function wakeUpAPI() {
  const button = document.getElementById('btnWakeOk');
  button.disabled = true;
  setText('statusWake', 'Carregando os horários...');
  const success = await loadSchedule();
  const icon = document.getElementById('wakeIcon');
  if (icon) {
    icon.className = 'mx-auto text-4xl';
    icon.textContent = success ? '🔔' : '⚠️';
  }
  setText('statusWake', success ? 'Horários carregados. Ative o som para iniciar.' : 'Falha ao conectar. Verifique se o backend está iniciado.');
  button.textContent = success ? 'Ativar som e iniciar' : 'Tentar novamente';
  button.disabled = false;
  button.classList.remove('opacity-50', 'cursor-not-allowed');
  button.onclick = success ? async () => {
    try {
      await unlockAudio();
      if (audioContext.state !== 'running') throw new Error('O navegador bloqueou o áudio. Tente novamente.');
      document.getElementById('overlayWakeup').style.display = 'none';
      setText('audioStatus', 'Som ativado. Mantenha esta página aberta para os sinais automáticos.');
    } catch (error) { setText('statusWake', error.message); }
  } : wakeUpAPI;
}

document.addEventListener('DOMContentLoaded', () => {
  const filter = document.getElementById('periodFilter');
  populatePeriods(filter);
  filter.value = selectedPeriod;
  filter.addEventListener('change', () => { selectedPeriod = filter.value; renderSchedule(); });
  document.getElementById('searchSignal')?.addEventListener('input', renderSchedule);
  const darkToggle = document.getElementById('darkToggle');
  document.documentElement.classList.toggle('dark', localStorage.getItem('darkMode') === 'true');
  const themeIcon = () => { darkToggle.textContent = document.documentElement.classList.contains('dark') ? '☀️' : '🌙'; };
  themeIcon();
  darkToggle.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('darkMode', document.documentElement.classList.contains('dark'));
    themeIcon();
  });
  document.getElementById('menuBtn')?.addEventListener('click', () => document.getElementById('sidebar').classList.remove('-translate-x-full'));
  document.getElementById('closeSidebar')?.addEventListener('click', () => document.getElementById('sidebar').classList.add('-translate-x-full'));
  document.getElementById('btnManualPlay')?.addEventListener('click', async function () {
    this.disabled = true;
    const duration = Number(document.getElementById('manualDuration').value) || 12;
    const success = await initAudio(document.getElementById('manualMusic').value, duration);
    setTimeout(() => { this.disabled = false; }, success ? duration * 1000 : 0);
  });
  window.addEventListener('schedule-updated', async () => { await loadSchedule(); schedulerTick(); });
  wakeUpAPI();
  schedulerTick();
  setInterval(schedulerTick, 1000);
  setInterval(loadSchedule, 30000);
});
