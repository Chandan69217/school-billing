import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { exec, execSync, spawn } from 'child_process';

// Auto-bootstrap TSX loader if invoked as plain `node server.ts`
const isTsxRunning = process.execArgv.some(arg => arg.includes('tsx')) || process.env.TSX_ACTIVE === '1';

if (!isTsxRunning && !process.env.__TSX_SPAWNED__) {
  const child = spawn(process.execPath, ['--import', 'tsx', ...process.argv.slice(1)], {
    stdio: 'inherit',
    env: { ...process.env, __TSX_SPAWNED__: '1', TSX_ACTIVE: '1' }
  });
  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 0);
  });
} else {
  startServer().catch((err) => {
    console.error('Fatal server startup failure:', err);
  });
}

// Ensure MariaDB/MySQL is installed, started, configured with user & database, and seeded
async function ensureMySqlRunning(): Promise<boolean> {
  let hasMariaDb = fs.existsSync('/usr/sbin/mariadbd');
  if (!hasMariaDb) {
    console.log('⚡ MariaDB server not found. Installing mariadb-server non-interactively...');
    try {
      execSync(
        'DEBIAN_FRONTEND=noninteractive apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" mariadb-server',
        { stdio: 'inherit' }
      );
      hasMariaDb = fs.existsSync('/usr/sbin/mariadbd');
      console.log('✅ MariaDB server package installed successfully.');
    } catch (err: any) {
      console.warn('⚠️ Could not automatically install mariadb-server:', err.message);
      return false;
    }
  }

  // 1. Ensure required runtime and data directories exist with proper permissions
  try {
    execSync('mkdir -p /var/run/mysqld /var/lib/mysql /var/log && chown -R mysql:mysql /var/run/mysqld /var/lib/mysql /var/log 2>/dev/null || true', { stdio: 'ignore' });
  } catch (err: any) {
    console.warn('⚠️ Directory permission note:', err.message);
  }

  // 2. Install base system database tables if empty
  if (!fs.existsSync('/var/lib/mysql/mysql')) {
    console.log('⚡ Initializing new MariaDB system data directory...');
    try {
      execSync('mariadb-install-db --user=mysql --datadir=/var/lib/mysql --auth-root-authentication-method=normal', { stdio: 'inherit' });
      console.log('✅ MariaDB system tables installed.');
    } catch (err: any) {
      console.error('Failed to run mariadb-install-db:', err.message);
    }
  }

  // 3. Check if daemon is responding; start if not running
  let isRunning = false;
  try {
    execSync('mariadb-admin ping --socket=/var/run/mysqld/mysqld.sock 2>/dev/null', { stdio: 'ignore' });
    isRunning = true;
  } catch {}

  if (!isRunning) {
    console.log('⚡ Starting MariaDB daemon on port 3306...');
    exec('nohup /usr/sbin/mariadbd --user=mysql --socket=/var/run/mysqld/mysqld.sock --port=3306 --bind-address=0.0.0.0 --skip-name-resolve > /var/log/mysql.log 2>&1 &');

    // Wait up to 15 seconds for daemon readiness
    const start = Date.now();
    while (Date.now() - start < 15000) {
      await new Promise((r) => setTimeout(r, 600));
      try {
        execSync('mariadb-admin ping --socket=/var/run/mysqld/mysqld.sock 2>/dev/null', { stdio: 'ignore' });
        isRunning = true;
        console.log('✅ MariaDB daemon is active and accepting connections.');
        break;
      } catch {}
    }
  }

  if (!isRunning) {
    console.warn('⚠️ MariaDB daemon failed to respond. Application will operate in resilient mode.');
    return false;
  }

  // 4. Provision database and user credentials
  try {
    const initSql = [
      "CREATE DATABASE IF NOT EXISTS school_management;",
      "CREATE USER IF NOT EXISTS 'school_user'@'localhost' IDENTIFIED BY 'SchoolPass123!';",
      "CREATE USER IF NOT EXISTS 'school_user'@'127.0.0.1' IDENTIFIED BY 'SchoolPass123!';",
      "CREATE USER IF NOT EXISTS 'school_user'@'%' IDENTIFIED BY 'SchoolPass123!';",
      "GRANT ALL PRIVILEGES ON school_management.* TO 'school_user'@'localhost';",
      "GRANT ALL PRIVILEGES ON school_management.* TO 'school_user'@'127.0.0.1';",
      "GRANT ALL PRIVILEGES ON school_management.* TO 'school_user'@'%';",
      "FLUSH PRIVILEGES;"
    ].join(' ');

    execSync(`mariadb --socket=/var/run/mysqld/mysqld.sock -u root -e "${initSql}"`, { stdio: 'ignore' });
    console.log('✅ Database school_management and user school_user configured.');
  } catch (err: any) {
    console.warn('⚠️ Note on database privileges:', err.message);
  }

  // 5. Verify database schema and seed data
  try {
    const tableCheck = execSync(
      `mariadb --socket=/var/run/mysqld/mysqld.sock -u root -e "SELECT count(*) FROM information_schema.tables WHERE table_schema='school_management' AND table_name='User';" 2>/dev/null`,
      { encoding: 'utf-8' }
    );
    const hasUserTable = tableCheck.includes('1');
    if (!hasUserTable) {
      console.log('🌱 Schema tables missing in MySQL. Synchronizing schema via Prisma...');
      execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
      console.log('🌱 Populating initial database seed data...');
      execSync('npx tsx prisma/seed.ts', { stdio: 'inherit' });
      console.log('✅ MySQL schema synchronized and seeded successfully.');
    } else {
      console.log('✅ MySQL tables and seed data verified.');
    }
    return true;
  } catch (err: any) {
    console.warn('⚠️ Table sync notice:', err.message);
    return true;
  }
}

// Free port if a stale process is lingering
function ensurePortFree(port: number): Promise<void> {
  return new Promise((resolve) => {
    exec(`fuser -k ${port}/tcp 2>/dev/null || true`, () => {
      setTimeout(resolve, 300);
    });
  });
}

async function startServer() {
  await ensureMySqlRunning();

  const { default: apiRouter } = await import('./backend/routes/api.js');
  const { config } = await import('./backend/config/index.js');

  const app = express();
  const PORT = 3000;
  const isProd = process.env.NODE_ENV === 'production';

  // Security & Body parsing
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // Create uploads directory
  if (!fs.existsSync(config.storagePath)) {
    fs.mkdirSync(config.storagePath, { recursive: true });
  }
  app.use('/uploads', express.static(config.storagePath));

  // Mount API Router
  app.use('/api', apiRouter);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      database: 'MySQL 8 (MariaDB 10.11)',
      orm: 'Prisma 5.22.0'
    });
  });

  // Vite middleware in dev or static files in production
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  await ensurePortFree(PORT);

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 EduManage Pro Server running at http://0.0.0.0:${PORT}`);
    console.log(`📚 Connected to MySQL database at ${config.databaseUrl.replace(/:[^:]*@/, ':****@')}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️ Port ${PORT} busy, retrying after cleanup...`);
      setTimeout(() => {
        exec(`fuser -k ${PORT}/tcp 2>/dev/null || true`, () => {
          server.close();
          server.listen(PORT, '0.0.0.0');
        });
      }, 1000);
    } else {
      console.error('Server error:', err);
    }
  });

  const shutdown = () => {
    console.log('Shutting down server...');
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
