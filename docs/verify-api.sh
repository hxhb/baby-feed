#!/bin/bash
# ══════════════════════════════════════════════════════════════
# Baby Feed API Connectivity Test
# Tests all endpoints from docs/HTTP_REQUESTS.md
# ══════════════════════════════════════════════════════════════

BASE="http://localhost:3000"
PASS=0; FAIL=0; TOTAL=0
COOKIE_FILE="/tmp/test-cookies-$$.txt"
TMPFILE="/tmp/api-response-$$.json"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m';  NC='\033[0m';     BOLD='\033[1m'

cleanup() { rm -f "$COOKIE_FILE" "$TMPFILE"; }
trap cleanup EXIT

TEST_EMAIL="testapi_$$@test.com"
TEST_PASS="Test1234!@#\$"
TEST_NAME="API Tester"

# ── Helpers ────────────────────────────────────────────────────
test_api() {
    local method="$1" path="$2" desc="$3" data="$4" expected="$5"
    TOTAL=$((TOTAL + 1))
    local args=("-s" "-w" "\n%{http_code}" "-X" "$method" "-o" "$TMPFILE")
    [ -n "$data" ] && args+=("-H" "Content-Type: application/json" "-d" "$data")
    [ "$USE_AUTH" = "1" ] && args+=("-b" "$COOKIE_FILE")
    [ -n "$USE_APIKEY" ] && args+=("-H" "Authorization: Bearer $USE_APIKEY")
    args+=("-H" "Origin: http://localhost:3000")

    local raw status
    raw=$(curl "${args[@]}" "${BASE}${path}")
    status=$(echo "$raw" | tail -1 | tr -d '\n\r')
    LAST_RESPONSE=$(cat "$TMPFILE" 2>/dev/null)

    local ok=false
    IFS=',' read -ra CODES <<< "$expected"
    for c in "${CODES[@]}"; do [ "$status" = "$c" ] && ok=true && break; done

    if $ok; then
        printf "${GREEN}  ✓${NC} %-7s %-45s → %s  %s\n" "[$method]" "$path" "$status" "$desc"
        PASS=$((PASS + 1))
    else
        printf "${RED}  ✗${NC} %-7s %-45s → %s (expected %s)  %s\n" "[$method]" "$path" "$status" "$expected" "$desc"
        FAIL=$((FAIL + 1))
    fi
}

extract_id()  { echo "$LAST_RESPONSE" | grep -oP '"id"\s*:\s*"[^"]*"'  | head -1 | grep -oP '"[^"]*"$' | tr -d '"'; }
extract_key() { echo "$LAST_RESPONSE" | grep -oP '"key"\s*:\s*"[^"]*"' | head -1 | grep -oP '"[^"]*"$' | tr -d '"'; }

do_login() {
    local email="$1" pass="$2"
    rm -f "$COOKIE_FILE"
    local csrf_resp csrf
    csrf_resp=$(curl -s -c "$COOKIE_FILE" "${BASE}/api/auth/csrf")
    csrf=$(echo "$csrf_resp" | grep -oP '"csrfToken"\s*:\s*"[^"]*"' | grep -oP '"[^"]*"$' | tr -d '"')
    # URL-encode special chars in password
    local encoded_pass
    encoded_pass=$(printf '%s' "$pass" | python3 -c "import sys,urllib.parse; print(urllib.parse.quote(sys.stdin.read(), safe=''))")
    curl -s -o /dev/null -b "$COOKIE_FILE" -c "$COOKIE_FILE" \
      -X POST "${BASE}/api/auth/callback/credentials" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "email=${email}&password=${encoded_pass}&csrfToken=${csrf}" -L
    # Verify
    local session_resp user_id
    session_resp=$(curl -s -b "$COOKIE_FILE" "${BASE}/api/auth/session")
    user_id=$(echo "$session_resp" | grep -oP '"id"\s*:\s*"[^"]*"' | head -1 | grep -oP '"[^"]*"$' | tr -d '"')
    [ -n "$user_id" ] && [ "$user_id" != "null" ]
}

section() { echo ""; printf "${BOLD}${CYAN}$1${NC}\n"; }

# ══════════════════════════════════════════════════════════════
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     Baby Feed API - Full Connectivity Test                 ║"
echo "║     Based on docs/HTTP_REQUESTS.md                         ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Test user: $TEST_EMAIL"
echo "╚══════════════════════════════════════════════════════════════╝"

# ══════════════════════════════════════════════════════════════
section "[1/14] 公开接口（无需认证）"
test_api GET "/api/auth/session"             "获取当前会话（未登录）" "" "200"
test_api GET "/api/site/registration-status" "查询注册状态"           "" "200"

# ══════════════════════════════════════════════════════════════
section "[2/14] 用户注册 (POST /api/auth/register)"
test_api POST "/api/auth/register" "正常注册" \
  "{\"email\":\"${TEST_EMAIL}\",\"password\":\"Test1234!@#\$\",\"name\":\"${TEST_NAME}\"}" "201"

test_api POST "/api/auth/register" "重复注册（应400）" \
  "{\"email\":\"${TEST_EMAIL}\",\"password\":\"Test1234!@#\$\",\"name\":\"${TEST_NAME}\"}" "400"

test_api POST "/api/auth/register" "缺字段（应400）" \
  '{"email":"bad"}' "400"

test_api POST "/api/auth/register" "弱密码（应400）" \
  '{"email":"weak@t.com","password":"123","name":"W"}' "400"

# ══════════════════════════════════════════════════════════════
section "[3/14] 用户登录 (POST /api/auth/callback/credentials)"
TOTAL=$((TOTAL + 1))
if do_login "$TEST_EMAIL" "$TEST_PASS"; then
    printf "${GREEN}  ✓${NC} 登录成功\n"
    PASS=$((PASS + 1))
    USE_AUTH=1
else
    printf "${RED}  ✗${NC} 登录失败，后续测试将受影响\n"
    FAIL=$((FAIL + 1))
fi

# ══════════════════════════════════════════════════════════════
section "[4/14] 用户管理"
test_api GET "/api/user/profile" "获取用户信息" "" "200"
test_api PUT "/api/user/profile" "修改用户名"   '{"name":"New Name"}' "200"

test_api PUT "/api/user/password" "修改密码-错误旧密码（应400）" \
  '{"currentPassword":"wrong","newPassword":"NewPass1234!@#$"}' "400"

test_api PUT "/api/user/password" "修改密码-正确" \
  "{\"currentPassword\":\"Test1234!@#\$\",\"newPassword\":\"Changed1234!@#\$\"}" "200"

# ⚠ Password change invalidates JWT (passwordVersion incremented), must re-login
TOTAL=$((TOTAL + 1))
if do_login "$TEST_EMAIL" 'Changed1234!@#$'; then
    printf "${GREEN}  ✓${NC} 密码修改后重新登录成功\n"
    PASS=$((PASS + 1))
else
    printf "${RED}  ✗${NC} 密码修改后重新登录失败\n"
    FAIL=$((FAIL + 1))
fi

# Change back
test_api PUT "/api/user/password" "改回原密码" \
  "{\"currentPassword\":\"Changed1234!@#\$\",\"newPassword\":\"Test1234!@#\$\"}" "200"

TOTAL=$((TOTAL + 1))
if do_login "$TEST_EMAIL" "$TEST_PASS"; then
    printf "${GREEN}  ✓${NC} 改回原密码后重新登录成功\n"
    PASS=$((PASS + 1))
else
    printf "${RED}  ✗${NC} 改回原密码后重新登录失败\n"
    FAIL=$((FAIL + 1))
fi

# ══════════════════════════════════════════════════════════════
section "[5/14] API Key 管理"
test_api GET  "/api/user/api-keys" "获取列表（空）" "" "200"

test_api POST "/api/user/api-keys" "创建 API Key" \
  '{"name":"Test Key","expiresInDays":30}' "201"
APIKEY_ID=$(extract_id)
APIKEY_FULL=$(extract_key)
[ -n "$APIKEY_FULL" ] && printf "     → key: ${APIKEY_FULL:0:24}...\n"

test_api GET  "/api/user/api-keys" "获取列表（应有1个）" "" "200"

[ -n "$APIKEY_ID" ] && test_api DELETE "/api/user/api-keys" "删除 API Key" \
  "{\"keyId\":\"${APIKEY_ID}\"}" "200"

# ══════════════════════════════════════════════════════════════
section "[6/14] API Key 认证测试"
test_api POST "/api/user/api-keys" "创建认证测试 Key" '{"name":"Auth Test"}' "201"
AUTH_KEY=$(extract_key)
AUTH_KEY_ID=$(extract_id)

if [ -n "$AUTH_KEY" ]; then
    SAVE_AUTH="$USE_AUTH"; USE_AUTH=0
    USE_APIKEY="$AUTH_KEY"

    test_api GET "/api/user/profile" "API Key 认证-获取用户" "" "200"
    test_api GET "/api/babies"       "API Key 认证-获取婴儿" "" "200"

    USE_APIKEY=""
    USE_APIKEY="bfk_0000000000000000000000000000000000000000000000000000000000000000"
    test_api GET "/api/user/profile" "无效 API Key（应401）" "" "401"

    USE_APIKEY=""; USE_AUTH="$SAVE_AUTH"
    test_api DELETE "/api/user/api-keys" "清理 Auth Key" "{\"keyId\":\"${AUTH_KEY_ID}\"}" "200"
fi

# ══════════════════════════════════════════════════════════════
section "[7/14] 婴儿管理"
test_api GET "/api/babies" "获取列表（空）" "" "200"

test_api POST "/api/babies" "创建婴儿" \
  '{"name":"测试宝宝","birthDate":"2024-06-15T00:00:00.000Z","gender":"MALE"}' "201"
BABY_ID=$(extract_id)
[ -n "$BABY_ID" ] && printf "     → babyId: ${BABY_ID}\n"

test_api GET "/api/babies" "获取列表（应有1个）" "" "200"

if [ -n "$BABY_ID" ]; then
    test_api GET "/api/babies/${BABY_ID}" "获取详情" "" "200"
    test_api PUT "/api/babies/${BABY_ID}" "更新信息" '{"name":"新名字"}' "200"
fi

test_api GET  "/api/babies/cxxxxxxxxxxxxxxxxxxxxxxxxx" "不存在的婴儿（应404）" "" "404"
test_api POST "/api/babies" "缺字段（应400）" '{"name":"bad"}' "400"

# ══════════════════════════════════════════════════════════════
section "[8/14] 喂养记录"
test_api GET "/api/feeding" "缺少宝宝参数（应400）" "" "400"

if [ -n "$BABY_ID" ]; then
    test_api GET "/api/feeding?babyId=${BABY_ID}" "按婴儿筛选" "" "200"
    test_api GET "/api/feeding?babyId=${BABY_ID}&date=2024-06-15" "按日期筛选" "" "200"

    test_api POST "/api/feeding" "亲喂 (BREAST_MILK)" \
      "{\"babyId\":\"${BABY_ID}\",\"type\":\"BREAST_MILK\",\"startTime\":\"2024-06-15T02:00:00.000Z\",\"endTime\":\"2024-06-15T02:30:00.000Z\",\"leftBreastDuration\":15,\"rightBreastDuration\":10}" "201"
    FEED_ID1=$(extract_id)

    test_api POST "/api/feeding" "配方奶 (FORMULA)" \
      "{\"babyId\":\"${BABY_ID}\",\"type\":\"FORMULA\",\"startTime\":\"2024-06-15T05:00:00.000Z\",\"formulaAmount\":120}" "201"
    FEED_ID2=$(extract_id)

    test_api POST "/api/feeding" "瓶喂母乳 (BREAST_MILK_BOTTLE)" \
      "{\"babyId\":\"${BABY_ID}\",\"type\":\"BREAST_MILK_BOTTLE\",\"startTime\":\"2024-06-15T08:00:00.000Z\",\"breastMilkAmount\":100}" "201"

    test_api POST "/api/feeding" "辅食 (SOLID_FOOD)" \
      "{\"babyId\":\"${BABY_ID}\",\"type\":\"SOLID_FOOD\",\"startTime\":\"2024-06-15T11:00:00.000Z\",\"solidFoodName\":\"米粉\",\"solidFoodAmount\":\"30g\"}" "201"

    [ -n "$FEED_ID1" ] && test_api PUT "/api/feeding/${FEED_ID1}?babyId=${BABY_ID}" "更新喂养记录" \
      '{"notes":"更新备注","leftBreastDuration":20}' "200"

    [ -n "$FEED_ID2" ] && test_api DELETE "/api/feeding/${FEED_ID2}?babyId=${BABY_ID}" "删除喂养记录" "" "200"
fi

test_api POST "/api/feeding" "缺必填字段（应400）" '{"type":"FORMULA"}' "400"

# ══════════════════════════════════════════════════════════════
section "[9/14] 健康记录"
test_api GET "/api/health" "缺少宝宝参数（应400）" "" "400"

if [ -n "$BABY_ID" ]; then
    test_api GET "/api/health?babyId=${BABY_ID}" "按婴儿筛选" "" "200"
    test_api GET "/api/health?babyId=${BABY_ID}&type=WEIGHT" "按类型筛选" "" "200"
    test_api GET "/api/health?babyId=${BABY_ID}&date=2024-06-15" "按日期筛选" "" "200"

    test_api POST "/api/health" "体重 (WEIGHT)" \
      "{\"babyId\":\"${BABY_ID}\",\"type\":\"WEIGHT\",\"recordedAt\":\"2024-06-15T02:00:00.000Z\",\"weight\":5.5}" "201"
    HEALTH_ID1=$(extract_id)

    test_api POST "/api/health" "身高 (HEIGHT)" \
      "{\"babyId\":\"${BABY_ID}\",\"type\":\"HEIGHT\",\"recordedAt\":\"2024-06-15T02:00:00.000Z\",\"height\":55}" "201"

    test_api POST "/api/health" "体温 (TEMPERATURE)" \
      "{\"babyId\":\"${BABY_ID}\",\"type\":\"TEMPERATURE\",\"recordedAt\":\"2024-06-15T02:00:00.000Z\",\"temperature\":36.5}" "201"

    test_api POST "/api/health" "用药 (MEDICATION)" \
      "{\"babyId\":\"${BABY_ID}\",\"type\":\"MEDICATION\",\"recordedAt\":\"2024-06-15T02:00:00.000Z\",\"medicationName\":\"维生素D\",\"medicationDose\":\"400IU\"}" "201"

    test_api POST "/api/health" "疫苗 (VACCINE)" \
      "{\"babyId\":\"${BABY_ID}\",\"type\":\"VACCINE\",\"recordedAt\":\"2024-06-15T02:00:00.000Z\",\"vaccineName\":\"乙肝疫苗\",\"vaccineDoseNumber\":1,\"vaccineTotalDoses\":3}" "201"

    test_api POST "/api/health" "尿布 (DIAPER)" \
      "{\"babyId\":\"${BABY_ID}\",\"type\":\"DIAPER\",\"recordedAt\":\"2024-06-15T03:00:00.000Z\",\"diaperType\":\"BOTH\"}" "201"
    HEALTH_ID2=$(extract_id)

    test_api POST "/api/health" "AD维生素 (AD_VITAMIN)" \
      "{\"babyId\":\"${BABY_ID}\",\"type\":\"AD_VITAMIN\",\"recordedAt\":\"2024-06-15T04:00:00.000Z\",\"adGiven\":true}" "201"

    test_api POST "/api/health" "睡眠 (SLEEP)" \
      "{\"babyId\":\"${BABY_ID}\",\"type\":\"SLEEP\",\"recordedAt\":\"2024-06-15T14:00:00.000Z\",\"sleepStartTime\":\"2024-06-15T14:00:00.000Z\",\"sleepEndTime\":\"2024-06-15T22:00:00.000Z\",\"sleepQuality\":\"GOOD\"}" "201"

    [ -n "$HEALTH_ID1" ] && test_api PUT "/api/health/${HEALTH_ID1}?babyId=${BABY_ID}" "更新健康记录" \
      '{"weight":5.8,"notes":"增重了"}' "200"

    [ -n "$HEALTH_ID2" ] && test_api DELETE "/api/health/${HEALTH_ID2}?babyId=${BABY_ID}" "删除健康记录" "" "200"
fi

test_api POST "/api/health" "缺必填字段（应400）" '{"type":"WEIGHT"}' "400"

# ══════════════════════════════════════════════════════════════
section "[10/14] 备忘录"
test_api GET "/api/memo" "缺少宝宝参数（应400）" "" "400"

if [ -n "$BABY_ID" ]; then
    test_api GET "/api/memo?babyId=${BABY_ID}" "按婴儿筛选" "" "200"
    test_api GET "/api/memo?babyId=${BABY_ID}&completed=false" "筛选未完成" "" "200"
    test_api GET "/api/memo?babyId=${BABY_ID}&date=2024-06-15&rangeDays=7" "按日期范围" "" "200"

    test_api POST "/api/memo" "创建备忘" \
      "{\"babyId\":\"${BABY_ID}\",\"title\":\"接种疫苗\",\"content\":\"带接种本\",\"scheduledAt\":\"2024-07-15T09:00:00.000Z\"}" "201"
    MEMO_ID=$(extract_id)

    [ -n "$MEMO_ID" ] && test_api PUT "/api/memo/${MEMO_ID}?babyId=${BABY_ID}" "标记完成" \
      '{"completed":true}' "200"
    [ -n "$MEMO_ID" ] && test_api PUT "/api/memo/${MEMO_ID}?babyId=${BABY_ID}" "取消完成" \
      '{"completed":false}' "200"

    test_api POST "/api/memo" "创建待删备忘" \
      "{\"babyId\":\"${BABY_ID}\",\"title\":\"待删\",\"scheduledAt\":\"2024-07-20T09:00:00.000Z\"}" "201"
    MEMO_ID2=$(extract_id)
    [ -n "$MEMO_ID2" ] && test_api DELETE "/api/memo/${MEMO_ID2}?babyId=${BABY_ID}" "删除备忘" "" "200"
fi

test_api POST "/api/memo" "缺必填字段（应400）" '{"title":"test"}' "400"

# ══════════════════════════════════════════════════════════════
section "[11/14] 统计数据"
if [ -n "$BABY_ID" ]; then
    test_api GET "/api/stats?babyId=${BABY_ID}"                      "多日统计（默认7天）" "" "200"
    test_api GET "/api/stats?babyId=${BABY_ID}&days=30"              "多日统计（30天）"    "" "200"
    test_api GET "/api/stats/day?babyId=${BABY_ID}&date=2024-06-15"  "单日统计"           "" "200"
    test_api GET "/api/sleep-summary?babyId=${BABY_ID}&date=2024-06-15" "睡眠摘要"        "" "200"
fi
test_api GET "/api/stats"          "缺 babyId（应400）"  "" "400"
test_api GET "/api/stats/day"      "缺参数（应400）"     "" "400"
test_api GET "/api/sleep-summary"  "缺参数（应400）"     "" "400"

# ══════════════════════════════════════════════════════════════
section "[12/14] 时间轴"
[ -n "$BABY_ID" ] && test_api GET "/api/timeline-dates?babyId=${BABY_ID}" "获取有效日期" "" "200"
test_api GET "/api/timeline-dates" "缺 babyId（应400）" "" "400"

# ══════════════════════════════════════════════════════════════
section "[13/14] 管理员接口"

# Promote test user to admin via DB
node -e "
import { createClient } from '@libsql/client';
const c = createClient({ url: 'file:./dev.db' });
await c.execute({ sql: 'UPDATE \"User\" SET role = ? WHERE email = ?', args: ['ADMIN', '${TEST_EMAIL}'] });
c.close();
" 2>/dev/null

# Need to re-login to pick up new role in JWT
do_login "$TEST_EMAIL" "$TEST_PASS"

test_api GET "/api/admin/check"    "检查管理员身份" "" "200"
test_api GET "/api/admin/settings" "获取站点设置"   "" "200"
test_api PUT "/api/admin/settings" "更新站点设置"   '{"allowRegistration":true}' "200"
test_api GET "/api/admin/users"    "获取用户列表"   "" "200"

# Create second user for admin operations
SAVE_AUTH="$USE_AUTH"; USE_AUTH=0
test_api POST "/api/auth/register" "注册测试目标用户" \
  '{"email":"target@test.com","password":"Test1234!@#$","name":"Target"}' "201"
USE_AUTH="$SAVE_AUTH"

USER2_ID=$(node -e "
import { createClient } from '@libsql/client';
const c = createClient({ url: 'file:./dev.db' });
const r = await c.execute({ sql: 'SELECT id FROM \"User\" WHERE email = ?', args: ['target@test.com'] });
if (r.rows.length) process.stdout.write(String(r.rows[0].id));
c.close();
" 2>/dev/null)

if [ -n "$USER2_ID" ]; then
    test_api PUT    "/api/admin/users" "修改用户角色"   "{\"userId\":\"${USER2_ID}\",\"role\":\"ADMIN\"}" "200"
    test_api DELETE "/api/admin/users" "管理员删除用户" "{\"userId\":\"${USER2_ID}\"}" "200"
fi

# ══════════════════════════════════════════════════════════════
section "[14/14] 未认证访问测试"
echo "  (middleware 返回 307 redirect = 认证拦截正常)"
SAVE_AUTH="$USE_AUTH"; USE_AUTH=0

test_api GET "/api/user/profile"      "未认证-用户信息（应307）"  "" "307"
test_api GET "/api/babies"            "未认证-婴儿列表（应307）"  "" "307"
test_api GET "/api/feeding"           "未认证-喂养记录（应307）"  "" "307"
test_api GET "/api/health"            "未认证-健康记录（应307）"  "" "307"
test_api GET "/api/memo"              "未认证-备忘录（应307）"    "" "307"
test_api GET "/api/stats?babyId=test" "未认证-统计（应307）"      "" "307"
test_api GET "/api/user/api-keys"     "未认证-API Key（应307）"   "" "307"

USE_AUTH="$SAVE_AUTH"

# ══════════════════════════════════════════════════════════════
section "[清理] 删除测试数据"

[ -n "$BABY_ID" ] && test_api DELETE "/api/babies/${BABY_ID}" "删除婴儿（级联删除）" "" "200"
test_api DELETE "/api/user/delete" "注销测试账户" "{\"password\":\"Test1234!@#\$\"}" "200"

# ══════════════════════════════════════════════════════════════
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
printf "║  ${BOLD}测试结果汇总${NC}                                             ║\n"
echo "╠══════════════════════════════════════════════════════════════╣"
printf "║  总计: %-4d │  ${GREEN}通过: %-4d${NC} │  ${RED}失败: %-4d${NC}                 ║\n" "$TOTAL" "$PASS" "$FAIL"
echo "╚══════════════════════════════════════════════════════════════╝"

if [ $FAIL -eq 0 ]; then
    printf "\n  ${GREEN}${BOLD}✅ 所有 API 接口连接测试通过！${NC}\n\n"
    exit 0
else
    printf "\n  ${RED}${BOLD}❌ 有 %d 个测试未通过，请检查上方失败项${NC}\n\n" "$FAIL"
    exit 1
fi
