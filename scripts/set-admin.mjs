/**
 * 将指定邮箱的用户设为管理员
 * 用法: node scripts/set-admin.mjs <email>
 * 如果不传邮箱，则将第一个注册的用户设为管理员
 * 
 * 使用 @libsql/client 直接操作 SQLite，无需 PrismaClient
 */
import { createClient } from '@libsql/client';

const DATABASE_URL = process.env.DATABASE_URL || 'file:/app/data/baby-feed.db';

async function main() {
  const url = DATABASE_URL.startsWith('file:') ? DATABASE_URL : `file:${DATABASE_URL}`;
  const client = createClient({ url });

  try {
    const email = process.argv[2];

    let user;
    if (email) {
      const result = await client.execute({
        sql: 'SELECT id, name, email, role FROM "User" WHERE email = ?',
        args: [email]
      });
      if (result.rows.length === 0) {
        console.error(`❌ 未找到邮箱为 ${email} 的用户`);
        process.exit(1);
      }
      user = result.rows[0];
    } else {
      const result = await client.execute(
        'SELECT id, name, email, role FROM "User" ORDER BY createdAt ASC LIMIT 1'
      );
      if (result.rows.length === 0) {
        console.error('❌ 数据库中没有用户');
        process.exit(1);
      }
      user = result.rows[0];
    }

    if (user.role === 'ADMIN') {
      console.log(`✅ 用户 ${user.name} (${user.email}) 已经是管理员`);
      return;
    }

    await client.execute({
      sql: 'UPDATE "User" SET role = ? WHERE id = ?',
      args: ['ADMIN', user.id]
    });

    console.log(`✅ 已将 ${user.name} (${user.email}) 设为管理员`);
  } finally {
    client.close();
  }
}

main().catch(err => {
  console.error('设置管理员失败:', err);
  process.exit(1);
});
