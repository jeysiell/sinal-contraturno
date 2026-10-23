document.addEventListener('DOMContentLoaded', () => {
  const editor = window.createScheduleEditor({ tableId: 'configScheduleTable', filterId: 'configFilterPeriod' });
  const dashboard = document.getElementById('dashboardSection');
  const config = document.getElementById('configSection');
  const navDashboard = document.getElementById('navDashboard');
  const navConfig = document.getElementById('navConfig');
  function switchSection(showConfig) {
    dashboard.classList.toggle('hidden', showConfig);
    config.classList.toggle('hidden', !showConfig);
    document.getElementById('pageTitle').textContent = showConfig ? 'Configurações' : 'Sinais';
    document.getElementById('pageEyebrow').textContent = '';
    for (const [nav, active] of [[navDashboard, !showConfig], [navConfig, showConfig]]) {
      for (const cls of ['bg-slate-900', 'text-white', 'shadow-soft', 'dark:bg-slate-800']) nav.classList.toggle(cls, active);
      for (const cls of ['text-slate-700', 'dark:text-slate-200', 'hover:bg-slate-100', 'dark:hover:bg-slate-800']) nav.classList.toggle(cls, !active);
    }
    if (window.innerWidth < 768) document.getElementById('sidebar').classList.add('-translate-x-full');
    if (showConfig) editor.load();
  }
  navDashboard.addEventListener('click', event => { event.preventDefault(); switchSection(false); });
  navConfig.addEventListener('click', event => { event.preventDefault(); switchSection(true); });
  const updateClock = () => {
    document.getElementById('configCurrentTime').textContent = new Date().toLocaleTimeString('pt-BR');
  };
  updateClock();
  setInterval(updateClock, 1000);
  switchSection(false);
});
