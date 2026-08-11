import { invalidateRequestCache } from '@/lib/client-request-cache'

/**
 * 清除与指定宝宝相关的所有客户端请求缓存
 * 在创建/更新/删除喂养或健康记录后调用
 */
export function invalidateRecordRelatedCaches(babyId: string) {
  invalidateRequestCache(`/api/babies`)
  invalidateRequestCache(`/api/feeding?babyId=${babyId}`)
  invalidateRequestCache(`/api/health?babyId=${babyId}`)
  invalidateRequestCache(`stats:${babyId}:`)
  invalidateRequestCache(`timeline:${babyId}:`)
  invalidateRequestCache(`timeline-dates:${babyId}`)
}
