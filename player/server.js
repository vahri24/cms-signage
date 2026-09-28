const express = require('express');
const path = require('path');
const config = require('./src/config');
const devices = require('./src/devices');

const app = express();

app.disable('x-powered-by');

app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));
app.use('/media', express.static(config.MEDIA_DIR));

app.get('/v1/content', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!match) {
    res.status(401).json({ ok: false, error: 'Missing bearer token' });
    return;
  }

  const device = devices.findActiveDeviceByToken(match[1].trim());
  if (!device) {
    res.status(401).json({ ok: false, error: 'Invalid or revoked token' });
    return;
  }
  devices.recordHeartbeat(device.id);

  const cfg = devices.readConfig();
  const area = cfg.areas[device.area];
  if (!area) {
    res.status(404).json({ ok: false, error: 'Assigned area no longer exists' });
    return;
  }

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.json({
    ok: true,
    area: { key: device.area, name: area.name || device.area },
    slides: (area.slides || []).map((s) => ({
      url: `${baseUrl}/media/${encodeURIComponent(s.file)}`,
      type: s.type,
      duration: s.duration,
    })),
  });
});

app.use((req, res) => {
  res.status(404).send('Not found');
});

const PORT = process.env.PORT || 80;
app.listen(PORT, () => {
  console.log(`signage-player listening on port ${PORT}`);
});
