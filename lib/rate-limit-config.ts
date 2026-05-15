/**
 * 速率限制集中配置
 *
 * 所有 API 路由的速率限制参数在此统一管理。
 * 修改此文件即可调整任意接口的限流策略，无需编辑各个路由文件。
 *
 * - limit:    时间窗口内允许的最大请求数
 * - windowMs: 时间窗口长度（毫秒）
 */

export interface RateLimitRule {
  limit: number
  windowMs: number
}

const rateLimitConfig: Record<string, RateLimitRule> = {
  // ============ 认证 ============
  'auth-login':             { limit: 10,  windowMs: 5 * 60 * 1000 },   // 5 分钟 10 次
  'auth-register':          { limit: 5,   windowMs: 60 * 1000 },       // 1 分钟 5 次

  // ============ 喂养记录 ============
  'feeding-list':           { limit: 180, windowMs: 60 * 1000 },
  'feeding-create':         { limit: 60,  windowMs: 10 * 60 * 1000 },
  'feeding-update':         { limit: 30,  windowMs: 10 * 60 * 1000 },
  'feeding-delete':         { limit: 20,  windowMs: 15 * 60 * 1000 },

  // ============ 健康记录 ============
  'health-list':            { limit: 180, windowMs: 60 * 1000 },
  'health-create':          { limit: 60,  windowMs: 10 * 60 * 1000 },
  'health-update':          { limit: 30,  windowMs: 10 * 60 * 1000 },
  'health-delete':          { limit: 20,  windowMs: 15 * 60 * 1000 },

  // ============ 宝宝管理 ============
  'babies-list':            { limit: 120, windowMs: 60 * 1000 },
  'babies-create':          { limit: 20,  windowMs: 10 * 60 * 1000 },
  'baby-detail-read':       { limit: 120, windowMs: 60 * 1000 },
  'baby-update':            { limit: 20,  windowMs: 10 * 60 * 1000 },
  'baby-delete':            { limit: 10,  windowMs: 15 * 60 * 1000 },

  // ============ 备忘录 ============
  'memo-list':              { limit: 180, windowMs: 60 * 1000 },
  'memo-create':            { limit: 60,  windowMs: 10 * 60 * 1000 },
  'memo-update':            { limit: 30,  windowMs: 10 * 60 * 1000 },
  'memo-delete':            { limit: 20,  windowMs: 15 * 60 * 1000 },

  // ============ 统计 / 时间轴 ============
  'stats-query':            { limit: 120, windowMs: 60 * 1000 },
  'stats-day-query':        { limit: 120, windowMs: 60 * 1000 },
  'sleep-summary':          { limit: 120, windowMs: 60 * 1000 },
  'timeline-valid-dates':   { limit: 180, windowMs: 60 * 1000 },

  // ============ 用户操作 ============
  'user-profile-read':      { limit: 60,  windowMs: 60 * 1000 },
  'user-profile-update':    { limit: 10,  windowMs: 10 * 60 * 1000 },
  'user-password-update':   { limit: 5,   windowMs: 10 * 60 * 1000 },
  'user-delete-account':    { limit: 3,   windowMs: 15 * 60 * 1000 },
  'user-api-key-list':      { limit: 60,  windowMs: 60 * 1000 },
  'user-api-key-create':    { limit: 5,   windowMs: 10 * 60 * 1000 },
  'user-api-key-delete':    { limit: 10,  windowMs: 10 * 60 * 1000 },

  // ============ 管理员 ============
  'admin-users-list':       { limit: 30,  windowMs: 60 * 1000 },
  'admin-users-delete':     { limit: 10,  windowMs: 15 * 60 * 1000 },
  'admin-users-role':       { limit: 10,  windowMs: 15 * 60 * 1000 },
  'admin-settings-read':    { limit: 30,  windowMs: 60 * 1000 },
  'admin-settings-update':  { limit: 10,  windowMs: 15 * 60 * 1000 },
}

// 默认规则：未配置的 action 使用此兜底值
const DEFAULT_RULE: RateLimitRule = { limit: 60, windowMs: 60 * 1000 }

/**
 * 获取指定 action 的速率限制规则
 * 如果 action 未在配置中定义，返回默认值
 */
export function getRateLimit(action: string): RateLimitRule {
  return rateLimitConfig[action] ?? DEFAULT_RULE
}
