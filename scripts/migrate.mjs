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

const DATABASE_URL = process.env.DATABASE_URL || 'file:/app/data/baby-feed.db';
const MIGRATIONS_DIR = join(process.cwd(), 'prisma', 'migrations');

async function migrate() {
  // 将 file:/path 格式转为 libsql 可用的格式
  const url = DATABASE_URL.startsWith('file:') ? DATABASE_URL : `file:${DATABASE_URL}`;
  
  const client = createClient({ url });

  try {
    // 创建迁移记录表（兼容 Prisma 格式）
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

      // 跳过空迁移
      const trimmed = sql.replace(/--.*$/gm, '').trim();
      if (!trimmed) {
        // 记录空迁移为已执行
        await client.execute({
          sql: `INSERT INTO "_prisma_migrations" ("id", "migration_name", "finished_at", "applied_steps_count") VALUES (?, ?, datetime('now'), 1)`,
          args: [randomUUID(), dir.name]
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

      for (const stmt of statements) {
        await client.execute(stmt);
      }

      // 记录迁移完成
      await client.execute({
        sql: `INSERT INTO "_prisma_migrations" ("id", "migration_name", "finished_at", "applied_steps_count") VALUES (?, ?, datetime('now'), ?)`,
        args: [randomUUID(), dir.name, statements.length]
      });

      console.log(`  ✓ ${dir.name}（${statements.length} 条语句）`);
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
