/**
 * 轻量级 SQLite 迁移脚本
 * 替代 prisma migrate deploy，避免在运行镜像中引入庞大的 Prisma CLI 依赖
 * 
 * 工作原理：
 * 1. 读取 prisma/migrations 目录下的所有迁移
 * 2. 检查 _prisma_migrations 表，跳过已执行的迁移
 * 3. 按顺序执行未应用的迁移 SQL
 * 4. 兼容 Prisma 的迁移记录格式
 */

import { createClient } from '@libsql/client';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';

const DATABASE_URL = process.env.DATABASE_URL || 'file:/app/data/baby-feed.db';
const MIGRATIONS_DIR = join(process.cwd(), 'prisma', 'migrations');

/**
 * 计算迁移文件的 checksum（与 Prisma 格式兼容）
 */
function computeChecksum(sql) {
  return createHash('sha256').update(sql).digest('hex');
}

/**
 * 确保 _prisma_migrations 表存在且结构正确
 * 兼容 Prisma 自建表（checksum NOT NULL 无 DEFAULT）和我们的格式
 */
async function ensureMigrationsTable(client) {
  // 先尝试创建表
  await client.execute(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id"                    TEXT PRIMARY KEY NOT NULL,
      "checksum"              TEXT NOT NULL DEFAULT '',
      "finished_at"           DATETIME,
      "migration_name"        TEXT NOT NULL,
      "logs"                  TEXT,
      "rolled_back_at"        DATETIME,
      "started_at"            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "applied_steps_count"   INTEGER NOT NULL DEFAULT 0
    )
  `);
}

/**
 * 检查某个表是否已经存在
 */
async function tableExists(client, tableName) {
  const result = await client.execute({
    sql: `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
    args: [tableName]
  });
  return result.rows.length > 0;
}

/**
 * 检查某个索引是否已经存在
 */
async function indexExists(client, indexName) {
  const result = await client.execute({
    sql: `SELECT name FROM sqlite_master WHERE type='index' AND name=?`,
    args: [indexName]
  });
  return result.rows.length > 0;
}

/**
 * 检查某个表中是否已经存在指定列
 */
async function columnExists(client, tableName, columnName) {
  const escapedTableName = tableName.replaceAll('"', '""');
  const result = await client.execute(`PRAGMA table_info("${escapedTableName}")`);
  return result.rows.some(row => String(row.name) === columnName);
}

function getStatementTarget(stmt) {
  const identifier = '(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_$]*))';
  const alterColumnMatch = stmt.match(new RegExp(`^ALTER\\s+TABLE\\s+${identifier}\\s+ADD\\s+COLUMN\\s+${identifier}`, 'i'));
  if (alterColumnMatch) {
    return {
      kind: 'column',
      tableName: alterColumnMatch[1] || alterColumnMatch[2],
      name: alterColumnMatch[3] || alterColumnMatch[4],
    };
  }

  const createTableMatch = stmt.match(new RegExp(`^CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${identifier}`, 'i'));
  if (createTableMatch) {
    return { kind: 'table', name: createTableMatch[1] || createTableMatch[2] };
  }

  const createIndexMatch = stmt.match(new RegExp(`^CREATE\\s+(?:UNIQUE\\s+)?INDEX\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${identifier}`, 'i'));
  if (createIndexMatch) {
    return { kind: 'index', name: createIndexMatch[1] || createIndexMatch[2] };
  }

  return null;
}

async function statementTargetExists(client, target) {
  if (!target) return false;
  if (target.kind === 'table') return tableExists(client, target.name);
  if (target.kind === 'index') return indexExists(client, target.name);
  return columnExists(client, target.tableName, target.name);
}

/**
 * 单条执行迁移语句。仅在目标表、索引或列已存在时跳过，其他错误保持失败。
 */
async function executeStatement(client, stmt) {
  const target = getStatementTarget(stmt);
  if (await statementTargetExists(client, target)) {
    console.log(`    ⚠ 跳过（已存在）: ${stmt.substring(0, 80)}...`);
    return false;
  }

  try {
    await client.execute(stmt);
    return true;
  } catch (err) {
    // 处理另一进程在预检查后完成相同 DDL 的极小竞态窗口。
    if (await statementTargetExists(client, target)) {
      console.log(`    ⚠ 跳过（已存在）: ${stmt.substring(0, 80)}...`);
      return false;
    }
    throw err;
  }
}

async function migrate() {
  // 将 file:/path 格式转为 libsql 可用的格式
  const url = DATABASE_URL.startsWith('file:') ? DATABASE_URL : `file:${DATABASE_URL}`;
  
  const client = createClient({ url });

  try {
    // 确保迁移记录表存在
    await ensureMigrationsTable(client);

    // 获取已执行的迁移
    const applied = await client.execute('SELECT migration_name FROM "_prisma_migrations" WHERE rolled_back_at IS NULL');
    const appliedSet = new Set(applied.rows.map(r => r.migration_name));

    // 读取迁移目录
    const entries = await readdir(MIGRATIONS_DIR, { withFileTypes: true });
    const migrationDirs = entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .sort((a, b) => a.name.localeCompare(b.name));

    let appliedCount = 0;

    for (const dir of migrationDirs) {
      if (appliedSet.has(dir.name)) {
        continue; // 已执行，跳过
      }

      const sqlPath = join(MIGRATIONS_DIR, dir.name, 'migration.sql');
      let sql;
      try {
        sql = await readFile(sqlPath, 'utf-8');
      } catch {
        console.warn(`  跳过 ${dir.name}（无 migration.sql）`);
        continue;
      }

      const checksum = computeChecksum(sql);

      // 跳过空迁移
      const trimmed = sql.replace(/--.*$/gm, '').trim();
      if (!trimmed) {
        // 记录空迁移为已执行
        await client.execute({
          sql: `INSERT INTO "_prisma_migrations" ("id", "checksum", "migration_name", "finished_at", "applied_steps_count") VALUES (?, ?, ?, datetime('now'), 1)`,
          args: [randomUUID(), checksum, dir.name]
        });
        console.log(`  ✓ ${dir.name}（空迁移，已标记）`);
        appliedCount++;
        continue;
      }

      console.log(`  ▸ 执行 ${dir.name} ...`);

      // 按分号拆分 SQL 语句并逐条执行
      const statements = sql
        .split(';')
        .map(s => s.replace(/--.*$/gm, '').trim())
        .filter(s => s.length > 0);

      // 逐条执行；已存在的表、索引或列会被精确识别并安全跳过
      let executedCount = 0;
      for (const stmt of statements) {
        if (await executeStatement(client, stmt)) executedCount++;
      }

      // 记录迁移完成（包含 checksum 以兼容 Prisma）
      await client.execute({
        sql: `INSERT INTO "_prisma_migrations" ("id", "checksum", "migration_name", "finished_at", "applied_steps_count") VALUES (?, ?, ?, datetime('now'), ?)`,
        args: [randomUUID(), checksum, dir.name, statements.length]
      });

      const skippedCount = statements.length - executedCount;
      const skippedLabel = skippedCount > 0 ? `，跳过 ${skippedCount} 条已存在语句` : '';
      console.log(`  ✓ ${dir.name}（执行 ${executedCount} 条${skippedLabel}）`);
      appliedCount++;
    }

    if (appliedCount === 0) {
      console.log('数据库已是最新，无需迁移。');
    } else {
      console.log(`成功应用 ${appliedCount} 个迁移。`);
    }
  } finally {
    client.close();
  }
}

console.log('开始数据库迁移...');
migrate()
  .then(() => {
    console.log('迁移完成。');
    process.exit(0);
  })
  .catch(err => {
    console.error('迁移失败:', err);
    process.exit(1);
  });
