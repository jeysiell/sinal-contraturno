window.createScheduleEditor = function ({ tableId, filterId }) {
  const { periods, defaultMusic, musicLabels, escapeHtml, currentPeriod, populatePeriods, request } = window.SinalSchedule;
  const byId = id => document.getElementById(id);
  const table = byId(tableId);
  const filter = byId(filterId);
  const form = byId('scheduleForm');
  const modal = byId('configModal');
  const content = byId('modalContent');
  const periodSelect = byId('periodSelect');
  let saving = false;

  populatePeriods(filter, true);
  populatePeriods(periodSelect);
  const durationSelect = byId('durationSelect');
  durationSelect.innerHTML = [5, 8, 10, 12, 15, 20, 30, 60].map(value =>
    `<option value="${value}">${value} segundos</option>`).join('');
  const musicSelect = byId('musicSelect');
  musicSelect.innerHTML = Object.entries(musicLabels).map(([value, label]) =>
    `<option value="${value}">${label}</option>`).join('');

  function openModal(period, signal) {
    form.reset();
    byId('editMode').value = String(Boolean(signal));
    byId('editPeriod').value = signal ? period : '';
    byId('editTimeOriginal').value = signal?.time || '';
    byId('modalTitle').textContent = signal ? 'Editar horário' : 'Novo horário';
    periodSelect.value = period || currentPeriod();
    byId('timeInput').value = signal?.time || '';
    byId('nameInput').value = signal?.name || '';
    musicSelect.value = signal?.music || defaultMusic;
    // Preserva durações e arquivos válidos já cadastrados no JSON.
    for (const [select, value, label] of [
      [durationSelect, String(signal?.duration || 12), `${signal?.duration || 12} segundos`],
      [musicSelect, signal?.music || defaultMusic, musicLabels[signal?.music || defaultMusic] || signal.music],
    ]) {
      if (!Array.from(select.options).some(option => option.value === value)) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        select.appendChild(option);
      }
      select.value = value;
    }
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    content.classList.remove('scale-95', 'opacity-0');
  }

  function closeModal() {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    content.classList.add('scale-95', 'opacity-0');
  }

  async function changed() {
    window.dispatchEvent(new Event('schedule-updated'));
    await load();
  }

  async function remove(period, time) {
    if (!confirm(`Remover o sinal de ${periods[period]} às ${time}?`)) return;
    try {
      await request(`/${encodeURIComponent(period)}/${encodeURIComponent(time)}`, { method: 'DELETE' });
      await changed();
    } catch (error) { alert(error.message); }
  }

  async function load() {
    table.innerHTML = '<tr><td colspan="6" class="py-6 text-center">Carregando horários...</td></tr>';
    const selected = filter.value || 'all';
    try {
      const data = await request();
      table.innerHTML = '';
      for (const [key, label] of Object.entries(periods)) {
        if (selected !== 'all' && selected !== key) continue;
        for (const signal of [...(data[key] || [])].sort((a, b) => a.time.localeCompare(b.time))) {
          const row = document.createElement('tr');
          row.className = 'cursor-pointer transition hover:bg-slate-100 dark:hover:bg-slate-800';
          row.innerHTML = `
            <td class="px-4 py-3">${label}</td>
            <td class="px-4 py-3">${escapeHtml(signal.time)}</td>
            <td class="px-4 py-3">${escapeHtml(signal.name)}</td>
            <td class="px-4 py-3">${escapeHtml(musicLabels[signal.music] || signal.music)}</td>
            <td class="px-4 py-3">${signal.duration}s</td>
            <td class="px-4 py-3 text-center"><button type="button" title="Remover horário" class="text-red-600"><i class="fas fa-trash"></i></button></td>`;
          row.addEventListener('click', () => openModal(key, signal));
          row.querySelector('button').addEventListener('click', event => {
            event.stopPropagation();
            remove(key, signal.time);
          });
          table.appendChild(row);
        }
      }
      if (!table.children.length) table.innerHTML = '<tr><td colspan="6" class="py-6 text-center">Nenhum horário cadastrado.</td></tr>';
    } catch (error) {
      table.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-red-600">${escapeHtml(error.message)}</td></tr>`;
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving) return;
    saving = true;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const data = await request();
      const period = periodSelect.value;
      const time = byId('timeInput').value;
      const name = byId('nameInput').value.trim();
      if (!name) throw new Error('Informe uma descrição.');
      if (byId('editMode').value === 'true') {
        const originalPeriod = byId('editPeriod').value;
        data[originalPeriod] = (data[originalPeriod] || []).filter(signal => signal.time !== byId('editTimeOriginal').value);
      }
      data[period] ||= [];
      if (data[period].some(signal => signal.time === time)) throw new Error('Já existe um sinal nesse dia, turno e horário.');
      data[period].push({ time, name, music: musicSelect.value, duration: Number(durationSelect.value) });
      Object.values(data).forEach(signals => signals.sort((a, b) => a.time.localeCompare(b.time)));
      await request('', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      closeModal();
      await changed();
    } catch (error) { alert(error.message); }
    finally { saving = false; submit.disabled = false; }
  });

  filter.addEventListener('change', load);
  byId('configBtn').addEventListener('click', () => openModal(filter.value === 'all' ? currentPeriod() : filter.value));
  byId('cancelConfigBtn').addEventListener('click', closeModal);
  modal.addEventListener('click', event => { if (event.target === modal && !saving) closeModal(); });
  return { load };
};
