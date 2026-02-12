const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');
const cors = require('cors');
const os = require('os');
const { initializeDatabase } = require('../models/database');
const { createLogger } = require('../ripper/logger');

const logger = createLogger('server');

function isDocker() {
  const fs = require('fs');
  try {
    return fs.existsSync('/.dockerenv') ||
      (fs.existsSync('/proc/1/cgroup') &&
       fs.readFileSync('/proc/1/cgroup', 'utf8').includes('docker'));
  } catch (err) {
    return false;
  }
}

function getHost() {
  if (isDocker()) return '0.0.0.0';
  const interfaces = os.networkInterfaces();
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        return addr.address;
      }
    }
  }
  return '0.0.0.0';
}

async function createApp(options = {}) {
  const {
    dbPath = undefined,
    port = 8080,
    sessionSecret = process.env.ARM_SESSION_SECRET || 'arm-secret-key-change-me',
  } = options;

  // Initialize database
  await initializeDatabase(dbPath);

  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Session
  app.use(session({
    store: new SQLiteStore({ db: 'sessions.db', dir: path.join(os.tmpdir(), 'arm') }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
    },
  }));

  // Ensure temp dir exists
  const tmpDir = path.join(os.tmpdir(), 'arm');
  const fs = require('fs');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  // View engine
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  // Static files
  app.use('/static', express.static(path.join(__dirname, 'public')));

  // Auth middleware
  app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.isAuthenticated = !!req.session.user;
    next();
  });

  // Register routes
  const authRoutes = require('./auth/auth');
  const jobRoutes = require('./jobs/jobs');
  const settingsRoutes = require('./settings/settings');
  const historyRoutes = require('./history/history');
  const logsRoutes = require('./logs/logs');
  const databaseRoutes = require('./database/database');
  const notificationRoutes = require('./notifications/notifications');
  const sendmoviesRoutes = require('./sendmovies/sendmovies');
  const apiRoutes = require('./api');

  app.use('/', authRoutes);
  app.use('/', jobRoutes);
  app.use('/', settingsRoutes);
  app.use('/', historyRoutes);
  app.use('/', logsRoutes);
  app.use('/', databaseRoutes);
  app.use('/', notificationRoutes);
  app.use('/', sendmoviesRoutes);
  app.use('/api', apiRoutes);

  // AI Dashboard — shows AI status, capabilities, and interactive testing
  const { loadConfig: loadArmConfig } = require('../config/config');
  const armConfig = loadArmConfig();
  const { DEFAULT_API_URL, DEFAULT_MODEL } = require('../ripper/ai_agent');

  app.get('/ai', (req, res) => {
    const aiKey = armConfig.AI_API_KEY || process.env.ARM_AI_API_KEY || '';
    const aiUrl = armConfig.AI_API_URL || process.env.ARM_AI_API_URL || DEFAULT_API_URL;
    const aiModel = armConfig.AI_MODEL || process.env.ARM_AI_MODEL || DEFAULT_MODEL;
    res.render('ai', {
      title: 'ARM - AI Dashboard',
      aiConfigured: !!aiKey,
      aiUrl,
      aiModel,
      aiKeyHint: aiKey ? aiKey.slice(-4) : '',
    });
  });

  // Initial setup — create admin account on first run
  const rateLimit = require('express-rate-limit');
  const setupLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many setup attempts, please try again later',
  });

  app.get('/setup', async (req, res) => {
    const { User } = require('../models/user');
    const userCount = await User.count();
    if (userCount > 0) {
      return res.redirect('/login');
    }
    res.render('setup', { title: 'ARM - Initial Setup' });
  });

  app.post('/setup', setupLimiter, async (req, res) => {
    try {
      const { User } = require('../models/user');
      const userCount = await User.count();
      if (userCount > 0) {
        return res.redirect('/login');
      }
      const { email, password } = req.body;
      if (!email || !password) {
        return res.render('setup', { title: 'ARM - Initial Setup' });
      }
      const hashedPw = await User.hashPassword(password);
      const user = new User({ email, password: hashedPw, hash: '' });
      await user.save();
      logger.info(`Admin user "${email}" created via setup`);
      res.redirect('/login');
    } catch (err) {
      logger.error(`Setup error: ${err.message}`);
      res.status(500).render('error', { title: 'Error', error: err.message });
    }
  });

  // MCP Server info page — shows server capabilities, tools, and resources
  const { TOOLS: MCP_TOOLS, RESOURCES: MCP_RESOURCES, SERVER_INFO: MCP_SERVER_INFO, MCP_PROTOCOL_VERSION } = require('../mcp/mcp_server');
  app.get('/mcp/server', (req, res) => {
    res.render('mcpserver', {
      title: 'ARM - MCP Server',
      serverInfo: MCP_SERVER_INFO,
      protocolVersion: MCP_PROTOCOL_VERSION,
      tools: MCP_TOOLS,
      resources: MCP_RESOURCES,
    });
  });

  // MCP Server — exposes ARM as an MCP app that the web UI and external clients connect to
  const { createMcpRouter } = require('../mcp/mcp_server');
  app.use('/mcp', createMcpRouter(armConfig));

  // MCP Client — connects to external MCP tool servers that ARM can use
  const { initializeMcpApps, listAllTools, listAllResources, getConnectedCount, hasMcpAppsConfigured, parseMcpAppsConfig } = require('../mcp/mcp_client');
  if (hasMcpAppsConfigured(armConfig)) {
    initializeMcpApps(armConfig).catch((err) => {
      logger.warn(`MCP apps initialization failed: ${err.message}`);
    });
  }

  // MCP status page — shows both server info and connected external apps
  app.get('/mcp/apps', async (req, res) => {
    const tools = listAllTools();
    const connectedCount = getConnectedCount();
    const configs = parseMcpAppsConfig(armConfig);
    let resources = [];
    try {
      resources = await listAllResources();
    } catch (err) {
      logger.warn(`Failed to list MCP resources: ${err.message}`);
    }
    res.render('mcp', {
      title: 'ARM - MCP Apps',
      tools,
      connectedCount,
      configuredCount: configs.length,
      configs,
      resources,
    });
  });

  // Home route
  app.get('/', async (req, res) => {
    try {
      const { Job } = require('../models/job');
      const { SystemInfo } = require('../models/system_info');
      const jobs = await Job.getActive();
      let systemInfo;
      try {
        systemInfo = await SystemInfo.get();
      } catch (e) {
        systemInfo = { cpu: 'Unknown', mem_total: 0 };
      }
      res.render('index', {
        title: 'ARM - Home',
        jobs,
        systemInfo,
      });
    } catch (err) {
      logger.error(`Home route error: ${err.message}`);
      res.status(500).render('error', { title: 'Error', error: err.message });
    }
  });

  // Error handler
  app.use((err, req, res, next) => {
    logger.error(`Unhandled error: ${err.message}`);
    if (req.accepts('json')) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.status(500).render('error', { title: 'Error', error: err.message });
    }
  });

  // 404 handler
  app.use((req, res) => {
    if (req.accepts('json')) {
      res.status(404).json({ success: false, error: 'Not found' });
    } else {
      res.status(404).render('error', { title: 'Not Found', error: 'Page not found' });
    }
  });

  return app;
}

async function startServer(options = {}) {
  const port = options.port || 8080;
  const app = await createApp(options);
  const host = getHost();

  app.listen(port, '0.0.0.0', () => {
    logger.info(`ARM UI running at http://${host}:${port}`);
  });

  return app;
}

module.exports = { createApp, startServer, isDocker, getHost };

if (require.main === module) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
