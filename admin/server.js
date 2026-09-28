const express = require('express');
const session = require('express-session');
const path = require('path');

const config = require('./src/config');
const loginRoutes = require('./src/routes/login');
const dashboardRoutes = require('./src/routes/dashboard');
const areasRoutes = require('./src/routes/areas');
const usersRoutes = require('./src/routes/users');
const auditRoutes = require('./src/routes/audit');
const actionsRoutes = require('./src/routes/actions');
const devicesRoutes = require('./src/routes/devices');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

app.use(
  session({
    name: 'signage_admin_sid',
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax' },
  })
);

app.use(express.static(path.join(__dirname, 'public')));
app.use('/media', express.static(config.MEDIA_DIR));

app.use(loginRoutes);
app.use(dashboardRoutes);
app.use(areasRoutes);
app.use(usersRoutes);
app.use(auditRoutes);
app.use(actionsRoutes);
app.use(devicesRoutes);

app.use((req, res) => {
  res.status(404).send('Not found');
});

const PORT = process.env.PORT || 80;
app.listen(PORT, () => {
  console.log(`signage-admin listening on port ${PORT}`);
});
