document.addEventListener('DOMContentLoaded', () => {
  const editor = window.createScheduleEditor({ tableId: 'scheduleTable', filterId: 'filterPeriod' });
  const updateClock = () => {
    document.getElementById('currentTime').textContent = new Date().toLocaleTimeString('pt-BR');
  };
  updateClock();
  setInterval(updateClock, 1000);
  editor.load();
});
