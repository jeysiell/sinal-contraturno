const express = require('express');
const cors = require('cors');
const fs = require('node:fs/promises');
const path = require('node:path');

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
const PERIODS = new Set(DAYS.flatMap(day => [`${day}_morning`, `${day}_afternoon`]));

function validateSchedule(schedule) {
  if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) {
    throw new Error('Envie um objeto com os horários por dia e turno.');
  }
  for (const [period, signals] of Object.entries(schedule)) {
    if (!PERIODS.has(period) || !Array.isArray(signals)) {
      throw new Error(`Dia/turno inválido: ${period}.`);
    }
    const times = new Set();
    for (const signal of signals) {
      if (!signal || typeof signal !== 'object' || typeof signal.time !== 'string' ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(signal.time) ||
          typeof signal.name !== 'string' || !signal.name.trim() ||
          typeof signal.music !== 'string' || !/^[\w-]+\.mp3$/.test(signal.music) ||
          !Number.isFinite(signal.duration) || signal.duration <= 0 || signal.duration > 3600) {
        throw new Error(`Sinal inválido em ${period}: informe hora, descrição, música MP3 e duração maior que 0 e até 3600 segundos.`);
      }
      if (times.has(signal.time)) throw new Error(`Horário duplicado em ${period}: ${signal.time}.`);
      times.add(signal.time);
    }
  }
  return schedule;
}

function createApp({ scheduleFilePath = path.join(__dirname, 'data', 'horarios.json') } = {}) {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  // Serializa alterações e evita leituras de JSON parcialmente escrito.
  let pendingWrite = Promise.resolve();
  const readSchedule = async () => validateSchedule(JSON.parse(
    (await fs.readFile(scheduleFilePath, 'utf8')).replace(/^\uFEFF/, '')
  ));
  const writeSchedule = async schedule => {
    const temporaryPath = `${scheduleFilePath}.tmp`;
    try {
      await fs.writeFile(temporaryPath, JSON.stringify(schedule, null, 2) + '\n', 'utf8');
      await fs.rename(temporaryPath, scheduleFilePath);
    } finally {
      await fs.unlink(temporaryPath).catch(() => {});
    }
  };
  const mutate = operation => {
    const result = pendingWrite.then(operation);
    pendingWrite = result.catch(() => {});
    return result;
  };

  app.get('/api/schedule', async (req, res, next) => {
    try { res.json(await readSchedule()); }
    catch (error) { next(error); }
  });

  app.put('/api/schedule', async (req, res, next) => {
    try { validateSchedule(req.body); }
    catch (error) { return res.status(400).json({ error: error.message }); }
    try {
      await mutate(() => writeSchedule(req.body));
      res.json({ message: 'Horários atualizados com sucesso!' });
    } catch (error) { next(error); }
  });

  app.delete('/api/schedule/:dia/:hora', async (req, res, next) => {
    const { dia, hora } = req.params;
    try {
      const found = await mutate(async () => {
        const schedule = await readSchedule();
        if (!PERIODS.has(dia) || !schedule[dia]?.some(signal => signal.time === hora)) return false;
        schedule[dia] = schedule[dia].filter(signal => signal.time !== hora);
        await writeSchedule(schedule);
        return true;
      });
      if (!found) return res.status(404).json({ error: 'Horário não encontrado para esse dia e turno.' });
      res.json({ message: `Horário ${hora} removido de ${dia}.` });
    } catch (error) { next(error); }
  });

  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'JSON inválido na requisição.' });
    }
    console.error('Erro ao acessar horários:', error.message);
    res.status(500).json({ error: 'Não foi possível acessar data/horarios.json. Verifique o arquivo e tente novamente.' });
  });
  return app;
}

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  createApp().listen(PORT, () => console.log(`SinalTech: http://localhost:${PORT}`));
}

module.exports = { createApp, validateSchedule };
