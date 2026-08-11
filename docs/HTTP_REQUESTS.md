# HTTP API 接口文档

本文档列出了 Baby Feed 应用所有支持的 HTTP API 接口，包括请求方式、参数、作用及返回结构。

## 目录

- [认证方式](#认证方式)
- [通用错误响应](#通用错误响应)
- [1. 认证相关](#1-认证相关)
  - [1.1 用户注册](#11-用户注册)
  - [1.2 用户登录 (NextAuth)](#12-用户登录-nextauth)
  - [1.3 获取当前会话](#13-获取当前会话)
- [2. 用户管理](#2-用户管理)
  - [2.1 获取用户信息](#21-获取用户信息)
  - [2.2 修改用户名](#22-修改用户名)
  - [2.3 修改密码](#23-修改密码)
  - [2.4 注销账户](#24-注销账户)
- [3. API Key 管理](#3-api-key-管理)
  - [3.1 获取 API Key 列表](#31-获取-api-key-列表)
  - [3.2 创建 API Key](#32-创建-api-key)
  - [3.3 删除 API Key](#33-删除-api-key)
  - [3.4 获取 API Key 请求日志](#34-获取-api-key-请求日志)
  - [3.5 清理 API Key 请求日志](#35-清理-api-key-请求日志)
- [4. 婴儿管理](#4-婴儿管理)
  - [4.1 获取婴儿列表](#41-获取婴儿列表)
  - [4.2 创建婴儿](#42-创建婴儿)
  - [4.3 获取婴儿详情](#43-获取婴儿详情)
  - [4.4 更新婴儿信息](#44-更新婴儿信息)
  - [4.5 删除婴儿](#45-删除婴儿)
- [5. 喂养记录](#5-喂养记录)
  - [5.1 获取喂养记录列表](#51-获取喂养记录列表)
  - [5.2 创建喂养记录](#52-创建喂养记录)
  - [5.3 更新喂养记录](#53-更新喂养记录)
  - [5.4 删除喂养记录](#54-删除喂养记录)
- [6. 健康记录](#6-健康记录)
  - [6.1 获取健康记录列表](#61-获取健康记录列表)
  - [6.2 创建健康记录](#62-创建健康记录)
  - [6.3 更新健康记录](#63-更新健康记录)
  - [6.4 删除健康记录](#64-删除健康记录)
- [7. 备忘录](#7-备忘录)
  - [7.1 获取备忘录列表](#71-获取备忘录列表)
  - [7.2 创建备忘录](#72-创建备忘录)
  - [7.3 更新备忘录](#73-更新备忘录)
  - [7.4 删除备忘录](#74-删除备忘录)
- [8. 统计数据](#8-统计数据)
  - [8.1 获取多日统计数据](#81-获取多日统计数据)
  - [8.2 获取单日统计数据](#82-获取单日统计数据)
  - [8.3 获取单日睡眠摘要](#83-获取单日睡眠摘要)
- [9. 时间轴](#9-时间轴)
  - [9.1 获取时间轴有效日期](#91-获取时间轴有效日期)
- [10. 站点设置（公开）](#10-站点设置公开)
  - [10.1 查询注册状态](#101-查询注册状态)
- [11. 管理员接口](#11-管理员接口)
  - [11.1 检查管理员身份](#111-检查管理员身份)
  - [11.2 获取站点设置](#112-获取站点设置)
  - [11.3 更新站点设置](#113-更新站点设置)
  - [11.4 获取用户列表](#114-获取用户列表)
  - [11.5 删除用户](#115-删除用户)
  - [11.6 修改用户角色](#116-修改用户角色)
- [12. 提醒系统](#12-提醒系统)
  - [12.1 获取提醒规则列表](#121-获取提醒规则列表)
  - [12.2 创建提醒规则](#122-创建提醒规则)
  - [12.3 更新提醒规则](#123-更新提醒规则)
  - [12.4 删除提醒规则](#124-删除提醒规则)
  - [12.5 获取执行日志](#125-获取执行日志)
  - [12.6 清理执行日志](#126-清理执行日志)
- [枚举值参考](#枚举值参考)

---

## 认证方式

所有接口（除特别标注为"公开"的接口外）都需要认证。支持两种认证方式：

| 方式 | 说明 |
|---|---|
| **Cookie/Session** | 通过 NextAuth JWT Session Token 认证（浏览器自动携带） |
| **API Key** | 请求头 `Authorization: Bearer bfk_<64位十六进制字符>` |

## 通用错误响应

所有接口共享以下错误格式：

```json
{ "error": "错误描述信息" }
```

| HTTP 状态码 | 说明 |
|---|---|
| `400` | 请求参数验证失败 |
| `401` | 未认证 |
| `403` | 权限不足 / CSRF 校验失败 |
| `404` | 资源不存在 |
| `429` | 请求过于频繁（响应头包含 `Retry-After`） |
| `500` | 服务器内部错误 |

---

## 1. 认证相关

### 1.1 用户注册

注册新用户账户。

- **URL**: `POST /api/auth/register`
- **认证**: 不需要（公开接口）
- **限流**: 5 次/60秒（按 IP）

**请求体 (JSON)**:

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `email` | string | 是 | 邮箱地址，格式需符合 `^[^\s@]+@[^\s@]+\.[^\s@]+$` |
| `password` | string | 是 | 密码，8-32 位，需包含大小写字母、数字和特殊字符 |
| `name` | string | 是 | 用户名，1-50 个字符 |

**成功响应** (`201`):

```json
{
  "id": "cxxxxxxxxxxxxxxxxxxxxxxxx",
  "email": "user@example.com",
  "name": "用户名"
}
```

**可能的错误**:
- `403` - 管理员已关闭注册功能
- `400` - 缺少必要字段 / 邮箱格式不正确 / 密码强度不足 / 注册失败

---

### 1.2 用户登录 (NextAuth)

由 NextAuth.js 处理的认证端点（Credentials Provider）。

- **URL**: `POST /api/auth/callback/credentials`
- **认证**: 不需要

**请求体 (form data)**:

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `email` | string | 是 | 邮箱地址 |
| `password` | string | 是 | 密码 |
| `csrfToken` | string | 是 | NextAuth CSRF Token |

> NextAuth 还暴露了一系列其他端点（`GET/POST /api/auth/*`），如 `/api/auth/csrf`、`/api/auth/providers`、`/api/auth/signout` 等，均由 NextAuth 框架自动处理。

---

### 1.3 获取当前会话

获取当前已认证用户的会话信息。

- **URL**: `GET /api/auth/session`
- **认证**: 可选（未认证返回 `user: null`）

**成功响应** (`200`):

```json
{
  "user": {
    "id": "cxxxxxxxxxxxxxxxxxxxxxxxx",
    "email": "user@example.com",
    "name": "用户名"
  }
}
```

**未认证响应** (`200`):

```json
{
  "user": null
}
```

---

## 2. 用户管理

### 2.1 获取用户信息

获取当前登录用户的详细信息。

- **URL**: `GET /api/user/profile`
- **认证**: 需要
- **限流**: 60 次/60秒

**成功响应** (`200`):

```json
{
  "id": "cxxxxxxxxxxxxxxxxxxxxxxxx",
  "email": "user@example.com",
  "name": "用户名",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

---

### 2.2 修改用户名

修改当前登录用户的用户名。

- **URL**: `PUT /api/user/profile`
- **认证**: 需要
- **限流**: 10 次/10分钟
- **CSRF**: 需要 Origin 校验

**请求体 (JSON)**:

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | string | 是 | 新用户名，1-50 个字符 |

**成功响应** (`200`):

```json
{
  "id": "cxxxxxxxxxxxxxxxxxxxxxxxx",
  "email": "user@example.com",
  "name": "新用户名"
}
```

---

### 2.3 修改密码

修改当前用户的密码。

- **URL**: `PUT /api/user/password`
- **认证**: 需要
- **限流**: 5 次/10分钟
- **CSRF**: 需要 Origin 校验

**请求体 (JSON)**:

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `currentPassword` | string | 是 | 当前密码 |
| `newPassword` | string | 是 | 新密码，8-32 位，需包含大小写字母、数字和特殊字符，不能与当前密码相同 |

**成功响应** (`200`):

```json
{
  "message": "密码修改成功"
}
```

---

### 2.4 注销账户

永久删除当前用户账户及所有关联数据（婴儿、喂养记录、健康记录、API Key）。

- **URL**: `DELETE /api/user/delete`
- **认证**: 需要
- **限流**: 3 次/15分钟
- **CSRF**: 需要 Origin 校验

**请求体 (JSON)**:

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `password` | string | 是 | 当前密码（用于确认） |

**成功响应** (`200`):

```json
{
  "message": "账户已注销"
}
```

---

## 3. API Key 管理

### 3.1 获取 API Key 列表

列出当前用户的所有 API Key（不返回明文或哈希值）。

- **URL**: `GET /api/user/api-keys`
- **认证**: 需要
- **限流**: 60 次/60秒

**成功响应** (`200`):

```json
[
  {
    "id": "cxxxxxxxxxxxxxxxxxxxxxxxx",
    "name": "My Key",
    "prefix": "bfk_abcd1234",
    "lastUsedAt": "2024-01-01T00:00:00.000Z",
    "expiresAt": "2025-01-01T00:00:00.000Z",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

---

### 3.2 创建 API Key

创建新的 API Key。明文 Key 仅在创建时返回一次。每个用户最多 10 个 Key。

- **URL**: `POST /api/user/api-keys`
- **认证**: 需要
- **限流**: 5 次/10分钟
- **CSRF**: 需要 Origin 校验

**请求体 (JSON)**:

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | string | 是 | Key 名称/用途描述，最长 100 字符 |
| `expiresInDays` | number | 否 | 过期天数（1-365），不传则永不过期 |

**成功响应** (`201`):

```json
{
  "id": "cxxxxxxxxxxxxxxxxxxxxxxxx",
  "name": "My Key",
  "prefix": "bfk_abcd1234",
  "expiresAt": "2025-01-01T00:00:00.000Z",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "key": "bfk_<64位十六进制字符>",
  "message": "请立即保存此 API Key，之后将无法再次查看完整 Key。"
}
```

---

### 3.3 删除 API Key

吊销（删除）一个 API Key。

- **URL**: `DELETE /api/user/api-keys`
- **认证**: 需要
- **限流**: 10 次/10分钟
- **CSRF**: 需要 Origin 校验

**请求体 (JSON)**:

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `keyId` | string | 是 | 要删除的 API Key ID（CUID 格式） |

**成功响应** (`200`):

```json
{
  "message": "API Key 已删除"
}
```

---

### 3.4 获取 API Key 请求日志

获取通过 API Key 发起的请求日志（仅保留最近 24 小时，存储在内存中，进程重启后清空）。

- **URL**: `GET /api/user/api-key-logs`
- **认证**: 需要
- **限流**: 60 次/60秒

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `keyId` | string | 否 | 筛选指定 API Key 的日志 |
| `limit` | number | 否 | 返回条数，默认 50，最大 100 |
| `offset` | number | 否 | 分页偏移量，默认 0 |

**成功响应** (`200`):

```json
{
  "logs": [
    {
      "id": "a1b2c3d4",
      "timestamp": 1716700000000,
      "source": "api-key",
      "userId": "cxxxxxxxxxxxxxxxxxxxxxxxx",
      "groupKey": "cxxxxxxxxxxxxxxxxxxxxxxxx",
      "groupLabel": "iOS快捷指令",
      "status": "success",
      "summary": "GET /api/feeding",
      "meta": {
        "method": "GET",
        "path": "/api/feeding",
        "ip": "192.168.1.1"
      }
    }
  ],
  "total": 42,
  "offset": 0,
  "limit": 50
}
```

---

### 3.5 清理 API Key 请求日志

手动清理 API Key 请求日志。

- **URL**: `DELETE /api/user/api-key-logs`
- **认证**: 需要
- **限流**: 10 次/10分钟
- **CSRF**: 需要 Origin 校验

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `keyId` | string | 否 | 仅清理指定 Key 的日志，不传则清理全部 |

**成功响应** (`200`):

```json
{
  "success": true,
  "deleted": 42
}
```

---

## 4. 婴儿管理

### 4.1 获取婴儿列表

获取当前用户创建的所有婴儿。

- **URL**: `GET /api/babies`
- **认证**: 需要
- **限流**: 120 次/60秒

**成功响应** (`200`):

```json
[
  {
    "id": "cxxxxxxxxxxxxxxxxxxxxxxxx",
    "name": "宝宝",
    "birthDate": "2024-01-01T00:00:00.000Z",
    "gender": "MALE",
    "createdBy": "cxxxxxxxxxxxxxxxxxxxxxxxx",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

---

### 4.2 创建婴儿

创建新的婴儿记录。

- **URL**: `POST /api/babies`
- **认证**: 需要
- **限流**: 20 次/10分钟
- **CSRF**: 需要 Origin 校验

**请求体 (JSON)**:

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | string | 是 | 婴儿名称，1-50 个字符 |
| `birthDate` | string | 是 | 出生日期，ISO 8601 格式 |
| `gender` | string | 是 | 性别，可选值: `MALE`, `FEMALE` |

**成功响应** (`201`):

```json
{
  "id": "cxxxxxxxxxxxxxxxxxxxxxxxx",
  "name": "宝宝",
  "birthDate": "2024-01-01T00:00:00.000Z",
  "gender": "MALE",
  "createdBy": "cxxxxxxxxxxxxxxxxxxxxxxxx",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

---

### 4.3 获取婴儿详情

获取单个婴儿的详细信息。

- **URL**: `GET /api/babies/:id`
- **认证**: 需要
- **限流**: 120 次/60秒

**路径参数**:

| 参数 | 类型 | 说明 |
|---|---|---|
| `id` | string | 婴儿 ID（CUID 格式） |

**成功响应** (`200`):

```json
{
  "id": "cxxxxxxxxxxxxxxxxxxxxxxxx",
  "name": "宝宝",
  "birthDate": "2024-01-01T00:00:00.000Z",
  "gender": "MALE",
  "createdBy": "cxxxxxxxxxxxxxxxxxxxxxxxx",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

---

### 4.4 更新婴儿信息

更新婴儿信息（支持部分更新）。

- **URL**: `PUT /api/babies/:id`
- **认证**: 需要
- **限流**: 20 次/10分钟
- **CSRF**: 需要 Origin 校验

**路径参数**:

| 参数 | 类型 | 说明 |
|---|---|---|
| `id` | string | 婴儿 ID（CUID 格式） |

**请求体 (JSON)**（所有字段可选）:

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | string | 否 | 婴儿名称，1-50 个字符 |
| `birthDate` | string | 否 | 出生日期，ISO 8601 格式 |
| `gender` | string | 否 | 性别，可选值: `MALE`, `FEMALE` |

**成功响应** (`200`): 同婴儿详情结构。

---

### 4.5 删除婴儿

删除婴儿及其所有关联的喂养和健康记录（级联删除）。

- **URL**: `DELETE /api/babies/:id`
- **认证**: 需要
- **限流**: 10 次/15分钟
- **CSRF**: 需要 Origin 校验

**路径参数**:

| 参数 | 类型 | 说明 |
|---|---|---|
| `id` | string | 婴儿 ID（CUID 格式） |

**成功响应** (`200`):

```json
{
  "success": true
}
```

---

## 5. 喂养记录

### 5.1 获取喂养记录列表

获取喂养记录，支持按婴儿和日期筛选。

- **URL**: `GET /api/feeding`
- **认证**: 需要
- **限流**: 180 次/60秒

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `babyId` | string | 否 | 婴儿 ID（CUID 格式），筛选指定婴儿 |
| `date` | string | 否 | 日期，格式 `YYYY-MM-DD`（北京时间），筛选当天记录 |

**成功响应** (`200`):

```json
[
  {
    "id": "cxxxxxxxxxxxxxxxxxxxxxxxx",
    "babyId": "cxxxxxxxxxxxxxxxxxxxxxxxx",
    "type": "BREAST_MILK",
    "leftBreastDuration": 15,
    "rightBreastDuration": 10,
    "breastMilkAmount": null,
    "formulaAmount": null,
    "solidFoodName": null,
    "solidFoodAmount": null,
    "adGiven": null,
    "startTime": "2024-01-01T02:00:00.000Z",
    "endTime": "2024-01-01T02:30:00.000Z",
    "notes": "备注",
    "createdBy": "cxxxxxxxxxxxxxxxxxxxxxxxx",
    "createdAt": "2024-01-01T02:00:00.000Z",
    "updatedAt": "2024-01-01T02:00:00.000Z",
    "baby": {
      "id": "cxxxxxxxxxxxxxxxxxxxxxxxx",
      "name": "宝宝",
      "birthDate": "2024-01-01T00:00:00.000Z",
      "gender": "MALE",
      "createdBy": "cxxxxxxxxxxxxxxxxxxxxxxxx",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
]
```

---

### 5.2 创建喂养记录

创建新的喂养记录。根据 `type` 的不同，需要传递不同的字段。

- **URL**: `POST /api/feeding`
- **认证**: 需要
- **限流**: 60 次/10分钟
- **CSRF**: 需要 Origin 校验

**请求体 (JSON)**:

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `babyId` | string | 是 | 婴儿 ID（CUID 格式） |
| `type` | string | 是 | 喂养类型：`BREAST_MILK`, `BREAST_MILK_BOTTLE`, `FORMULA`, `SOLID_FOOD` |
| `startTime` | string | 是 | 开始时间，ISO 8601 格式 |
| `endTime` | string | 否 | 结束时间，ISO 8601 格式 |
| `notes` | string | 否 | 备注 |

**按类型的附加字段**:

| 类型 | 字段 | 类型 | 说明 |
|---|---|---|---|
| `BREAST_MILK` | `leftBreastDuration` | number | 左侧哺乳时长（分钟） |
| `BREAST_MILK` | `rightBreastDuration` | number | 右侧哺乳时长（分钟） |
| `BREAST_MILK_BOTTLE` | `breastMilkAmount` | number | 母乳瓶喂量（ml） |
| `FORMULA` | `formulaAmount` | number | 配方奶量（ml） |
| `SOLID_FOOD` | `solidFoodName` | string | 辅食名称 |
| `SOLID_FOOD` | `solidFoodAmount` | string | 辅食量 |

**成功响应** (`201`): 返回创建的记录（含 `baby` 关联对象），结构同列表中的单条记录。

---

### 5.3 更新喂养记录

更新喂养记录（支持部分更新）。未提供的字段保持不变；更改 `type` 时，非对应类型的字段会自动清空。

- **URL**: `PUT /api/feeding/:id?babyId=ID`
- **认证**: 需要
- **限流**: 30 次/10分钟
- **CSRF**: 需要 Origin 校验

**路径参数**:

| 参数 | 类型 | 说明 |
|---|---|---|
| `id` | string | 喂养记录 ID（CUID 格式） |

**请求体 (JSON)**（所有字段可选）:

| 字段 | 类型 | 说明 |
|---|---|---|
| `type` | string | 喂养类型 |
| `startTime` | string | 开始时间 |
| `endTime` | string \| null | 结束时间，传 `null` 可清空 |
| `leftBreastDuration` | number | 左侧哺乳时长 |
| `rightBreastDuration` | number | 右侧哺乳时长 |
| `breastMilkAmount` | number | 母乳瓶喂量 |
| `formulaAmount` | number | 配方奶量 |
| `solidFoodName` | string | 辅食名称 |
| `solidFoodAmount` | string | 辅食量 |
| `adGiven` | boolean | 是否给予 AD |
| `notes` | string | 备注 |

**成功响应** (`200`): 返回更新后的记录（含 `baby` 关联对象）。

---

### 5.4 删除喂养记录

删除一条喂养记录。

- **URL**: `DELETE /api/feeding/:id?babyId=ID`
- **认证**: 需要
- **限流**: 20 次/15分钟
- **CSRF**: 需要 Origin 校验

**路径参数**:

| 参数 | 类型 | 说明 |
|---|---|---|
| `id` | string | 喂养记录 ID（CUID 格式） |

**成功响应** (`200`):

```json
{
  "success": true
}
```

---

## 6. 健康记录

### 6.1 获取健康记录列表

获取健康记录，支持按婴儿、日期和类型筛选。睡眠记录支持跨天查询（`sleepStartTime` 或 `recordedAt` 落在指定日期内均会返回）。

- **URL**: `GET /api/health`
- **认证**: 需要
- **限流**: 180 次/60秒

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `babyId` | string | 否 | 婴儿 ID（CUID 格式） |
| `date` | string | 否 | 日期，格式 `YYYY-MM-DD`（北京时间） |
| `type` | string | 否 | 健康记录类型，见[枚举值参考](#枚举值参考) |

**成功响应** (`200`):

```json
[
  {
    "id": "cxxxxxxxxxxxxxxxxxxxxxxxx",
    "babyId": "cxxxxxxxxxxxxxxxxxxxxxxxx",
    "type": "WEIGHT",
    "weight": 5.5,
    "height": null,
    "temperature": null,
    "medicationName": null,
    "medicationDose": null,
    "vaccineName": null,
    "vaccineManufacturer": null,
    "vaccineDoseNumber": null,
    "vaccineTotalDoses": null,
    "diaperType": null,
    "diaperStatus": null,
    "adGiven": null,
    "sleepStartTime": null,
    "sleepEndTime": null,
    "sleepQuality": null,
    "toothEruptions": [],
    "recordedAt": "2024-01-01T02:00:00.000Z",
    "notes": null,
    "createdBy": "cxxxxxxxxxxxxxxxxxxxxxxxx",
    "createdAt": "2024-01-01T02:00:00.000Z",
    "updatedAt": "2024-01-01T02:00:00.000Z",
    "baby": { ... }
  }
]
```

---

### 6.2 创建健康记录

创建新的健康记录。根据 `type` 的不同，需要传递不同的字段，非对应类型的字段会被存为 `null`。

- **URL**: `POST /api/health`
- **认证**: 需要
- **限流**: 60 次/10分钟
- **CSRF**: 需要 Origin 校验

**请求体 (JSON)**:

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `babyId` | string | 是 | 婴儿 ID（CUID 格式） |
| `type` | string | 是 | 记录类型：`WEIGHT`, `HEIGHT`, `TEMPERATURE`, `MEDICATION`, `VACCINE`, `DIAPER`, `AD_VITAMIN`, `SLEEP`, `TOOTH_ERUPTION`, `CUSTOM` |
| `recordedAt` | string | 是 | 记录时间，ISO 8601 格式 |
| `notes` | string | 否 | 备注 |

**按类型的附加字段**:

| 类型 | 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| `WEIGHT` | `weight` | number | 否 | 体重（kg） |
| `HEIGHT` | `height` | number | 否 | 身高（cm） |
| `TEMPERATURE` | `temperature` | number | 否 | 体温（℃） |
| `MEDICATION` | `medicationName` | string | 否 | 药品名称 |
| `MEDICATION` | `medicationDose` | string | 否 | 药品剂量 |
| `VACCINE` | `vaccineName` | string | 是 | 疫苗名称 |
| `VACCINE` | `vaccineManufacturer` | string | 否 | 疫苗生产商 |
| `VACCINE` | `vaccineDoseNumber` | number | 是 | 当前针次 |
| `VACCINE` | `vaccineTotalDoses` | number | 是 | 总针数 |
| `DIAPER` | `diaperType` | string | 否 | 尿布类型：`PEE`, `POOP`, `BOTH` |
| `DIAPER` | `diaperStatus` | string | 否 | 尿布状态 |
| `AD_VITAMIN` | `adGiven` | boolean | 否 | 是否给予 AD 维生素 |
| `SLEEP` | `sleepStartTime` | string | 否 | 睡眠开始时间，ISO 8601 格式 |
| `SLEEP` | `sleepEndTime` | string | 否 | 睡眠结束时间，ISO 8601 格式 |
| `SLEEP` | `sleepQuality` | string | 否 | 睡眠质量 |
| `TOOTH_ERUPTION` | `toothCodes` | string[] | 是 | 本次同时萌出的乳牙 FDI 编码，1-20 个且不可重复 |

乳牙编码使用 FDI 两位编号：上颌右侧 `51`-`55`、上颌左侧 `61`-`65`、下颌左侧 `71`-`75`、下颌右侧 `81`-`85`。同一次请求中的牙齿视为同时萌出；同一宝宝的同一牙位只能记录一次。

**成功响应** (`201`): 返回创建的记录（含 `baby` 关联对象）。

---

### 6.3 更新健康记录

更新健康记录（支持部分更新）。未提供的字段保持不变；更改 `type` 时，非对应类型的字段会自动清空。

- **URL**: `PUT /api/health/:id?babyId=ID`
- **认证**: 需要
- **限流**: 30 次/10分钟
- **CSRF**: 需要 Origin 校验

**路径参数**:

| 参数 | 类型 | 说明 |
|---|---|---|
| `id` | string | 健康记录 ID（CUID 格式） |

**请求体 (JSON)**（所有字段可选）:

| 字段 | 类型 | 说明 |
|---|---|---|
| `type` | string | 记录类型 |
| `recordedAt` | string | 记录时间 |
| `weight` | number | 体重 |
| `height` | number | 身高 |
| `temperature` | number | 体温 |
| `medicationName` | string | 药品名称 |
| `medicationDose` | string | 药品剂量 |
| `vaccineName` | string | 疫苗名称 |
| `vaccineManufacturer` | string | 疫苗生产商 |
| `vaccineDoseNumber` | number | 当前针次 |
| `vaccineTotalDoses` | number | 总针数 |
| `diaperType` | string | 尿布类型 |
| `diaperStatus` | string | 尿布状态 |
| `adGiven` | boolean | 是否给予 AD |
| `sleepStartTime` | string | 睡眠开始时间 |
| `sleepEndTime` | string | 睡眠结束时间 |
| `sleepQuality` | string | 睡眠质量 |
| `toothCodes` | string[] | 长牙记录的乳牙 FDI 编码；提交时会替换该记录的全部牙位 |
| `notes` | string | 备注 |

**成功响应** (`200`): 返回更新后的记录（含 `baby` 关联对象）。

---

### 6.4 删除健康记录

删除一条健康记录。

- **URL**: `DELETE /api/health/:id?babyId=ID`
- **认证**: 需要
- **限流**: 20 次/15分钟
- **CSRF**: 需要 Origin 校验

**路径参数**:

| 参数 | 类型 | 说明 |
|---|---|---|
| `id` | string | 健康记录 ID（CUID 格式） |

**成功响应** (`200`):

```json
{
  "success": true
}
```

---

## 7. 备忘录

### 7.1 获取备忘录列表

获取指定婴儿的所有备忘录，按备忘时间升序排列。支持按完成状态和日期范围筛选。

- **URL**: `GET /api/memo`
- **认证**: 需要
- **限流**: 180 次/60秒

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `babyId` | string | 否 | 婴儿 ID（CUID 格式），筛选指定婴儿的备忘录 |
| `completed` | string | 否 | 完成状态筛选：`true` 仅已完成，`false` 仅未完成，不传则返回全部 |
| `date` | string | 否 | 中心日期，格式 `YYYY-MM-DD`（北京时间），配合 `rangeDays` 筛选日期范围内的备忘 |
| `rangeDays` | number | 否 | 日期范围天数（1-365），默认 `7`。返回 `[date - rangeDays, date + rangeDays]` 范围内的备忘。需配合 `date` 使用 |

**筛选组合示例**:

```
# 获取某个宝宝所有未完成的备忘
GET /api/memo?babyId=cxxx&completed=false

# 获取 2024-02-01 前后 7 天内未完成的备忘
GET /api/memo?babyId=cxxx&completed=false&date=2024-02-01

# 获取 2024-02-01 前后 14 天内的所有备忘（含已完成）
GET /api/memo?babyId=cxxx&date=2024-02-01&rangeDays=14
```

**成功响应** (`200`):

```json
[
  {
    "id": "cxxxxxxxxxxxxxxxxxxxxxxxx",
    "babyId": "cxxxxxxxxxxxxxxxxxxxxxxxx",
    "title": "接种第二针乙肝疫苗",
    "content": "社区卫生服务中心，需要带接种本",
    "scheduledAt": "2024-02-01T09:00:00.000Z",
    "completed": false,
    "completedAt": null,
    "createdAt": "2024-01-15T02:00:00.000Z",
    "updatedAt": "2024-01-15T02:00:00.000Z",
    "createdBy": "cxxxxxxxxxxxxxxxxxxxxxxxx"
  }
]
```

---

### 7.2 创建备忘录

创建新的备忘录。

- **URL**: `POST /api/memo`
- **认证**: 需要
- **限流**: 60 次/10分钟
- **CSRF**: 需要 Origin 校验

**请求体 (JSON)**:

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `babyId` | string | 是 | 婴儿 ID（CUID 格式） |
| `title` | string | 是 | 备忘标题，1-100 个字符 |
| `content` | string | 否 | 备忘详细内容，最长 500 个字符 |
| `scheduledAt` | string | 是 | 备忘时间（计划执行时间），ISO 8601 格式，允许未来 5 年内 |

**成功响应** (`201`):

```json
{
  "id": "cxxxxxxxxxxxxxxxxxxxxxxxx",
  "babyId": "cxxxxxxxxxxxxxxxxxxxxxxxx",
  "title": "接种第二针乙肝疫苗",
  "content": "社区卫生服务中心，需要带接种本",
  "scheduledAt": "2024-02-01T09:00:00.000Z",
  "completed": false,
  "completedAt": null,
  "createdAt": "2024-01-15T02:00:00.000Z",
  "updatedAt": "2024-01-15T02:00:00.000Z",
  "createdBy": "cxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

**可能的错误**:
- `400` - 缺少必要字段 / 标题为空 / 时间格式无效 / 时间超出合理范围
- `404` - 婴儿不存在

---

### 7.3 更新备忘录

更新备忘录（支持部分更新）。可用于修改标题、内容、时间，或标记完成/取消完成。

- **URL**: `PUT /api/memo/:id?babyId=ID`
- **认证**: 需要
- **限流**: 30 次/10分钟
- **CSRF**: 需要 Origin 校验

**路径参数**:

| 参数 | 类型 | 说明 |
|---|---|---|
| `id` | string | 备忘录 ID（CUID 格式） |

**请求体 (JSON)**（所有字段可选）:

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string | 备忘标题，1-100 个字符 |
| `content` | string \| null | 备忘内容，传 `null` 或空字符串可清空 |
| `scheduledAt` | string | 备忘时间，ISO 8601 格式 |
| `completed` | boolean | 是否已完成。设为 `true` 时自动记录 `completedAt`；设为 `false` 时清空 `completedAt` |

**成功响应** (`200`):

```json
{
  "id": "cxxxxxxxxxxxxxxxxxxxxxxxx",
  "babyId": "cxxxxxxxxxxxxxxxxxxxxxxxx",
  "title": "接种第二针乙肝疫苗",
  "content": "已完成",
  "scheduledAt": "2024-02-01T09:00:00.000Z",
  "completed": true,
  "completedAt": "2024-02-01T10:30:00.000Z",
  "createdAt": "2024-01-15T02:00:00.000Z",
  "updatedAt": "2024-02-01T10:30:00.000Z",
  "createdBy": "cxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

**可能的错误**:
- `400` - 标题为空 / 时间格式无效
- `404` - 备忘不存在

---

### 7.4 删除备忘录

删除一条备忘录。

- **URL**: `DELETE /api/memo/:id?babyId=ID`
- **认证**: 需要
- **限流**: 20 次/15分钟
- **CSRF**: 需要 Origin 校验

**路径参数**:

| 参数 | 类型 | 说明 |
|---|---|---|
| `id` | string | 备忘录 ID（CUID 格式） |

**成功响应** (`200`):

```json
{
  "success": true
}
```

---

## 8. 统计数据

### 8.1 获取多日统计数据

获取指定婴儿在一段时间内的综合统计数据，包含每日汇总、趋势数据、喂养热力图等。

- **URL**: `GET /api/stats`
- **认证**: 需要
- **限流**: 120 次/60秒

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `babyId` | string | 是 | 婴儿 ID（CUID 格式） |
| `days` | number | 否 | 统计天数，1-365，默认 `7` |

**成功响应** (`200`):

```json
{
  "baby": {
    "id": "cxxxxxxxxxxxxxxxxxxxxxxxx",
    "name": "宝宝",
    "birthDate": "2024-01-01T00:00:00.000Z",
    "gender": "MALE",
    "createdAt": "...",
    "updatedAt": "...",
    "createdBy": "..."
  },
  "todayStats": {
    "date": "2024-01-07",
    "breastFeedingCount": 3,
    "totalBreastDuration": 45,
    "leftBreastDuration": 25,
    "rightBreastDuration": 20,
    "breastBottleCount": 1,
    "totalBreastMilkAmount": 120,
    "formulaCount": 2,
    "totalFormulaAmount": 180,
    "adGiven": true,
    "peeCount": 5,
    "poopCount": 2,
    "nightFeedingCount": 1,
    "sleepDurationMinutes": 480,
    "sleepCount": 3,
    "weight": 5.5,
    "height": 55,
    "temperature": 36.5
  },
  "lastDays": [
    { "date": "2024-01-01", "breastFeedingCount": 0, "..." : "..." },
    { "date": "2024-01-02", "..." : "..." }
  ],
  "totalStats": {
    "totalFeedings": 42,
    "totalFormulaAmount": 1260,
    "totalBreastDuration": 315,
    "totalBreastMilkAmount": 840
  },
  "weightTrend": [
    { "date": "2024-01-01", "recordedAt": "2024-01-01T02:00:00.000Z", "weight": 3.5 },
    { "date": "2024-01-07", "recordedAt": "2024-01-07T02:00:00.000Z", "weight": 5.5 }
  ],
  "heightTrend": [
    { "date": "2024-01-01", "recordedAt": "2024-01-01T02:00:00.000Z", "height": 50 },
    { "date": "2024-01-07", "recordedAt": "2024-01-07T02:00:00.000Z", "height": 55 }
  ],
  "vaccineRecords": [
    {
      "id": "cxxxxxxxxxxxxxxxxxxxxxxxx",
      "vaccineName": "乙肝疫苗",
      "date": "2024-01-05",
      "recordedAt": "2024-01-05T02:00:00.000Z",
      "notes": null,
      "vaccineDoseNumber": 1,
      "vaccineTotalDoses": 3
    }
  ],
  "medicationRecords": [
    {
      "id": "cxxxxxxxxxxxxxxxxxxxxxxxx",
      "medicationName": "维生素D",
      "medicationDose": "400IU",
      "date": "2024-01-06",
      "recordedAt": "2024-01-06T02:00:00.000Z",
      "notes": null
    }
  ],
  "feedingIntervals": [120, 150, 180, 90],
  "feedingHeatmap": [
    { "date": "2024-01-07", "hour": 8, "count": 1 },
    { "date": "2024-01-07", "hour": 12, "count": 2 }
  ],
  "babyBirthDate": "2024-01-01"
}
```

**字段说明**:

| 字段 | 说明 |
|---|---|
| `todayStats` | 今日（北京时间）的统计数据 |
| `lastDays` | 最近 N 天的每日统计数据数组（按日期升序） |
| `totalStats` | 整个查询范围内的汇总统计 |
| `weightTrend` | 所有历史体重记录（不限于查询范围） |
| `heightTrend` | 所有历史身高记录（不限于查询范围） |
| `vaccineRecords` | 所有历史疫苗记录（不限于查询范围） |
| `medicationRecords` | 查询范围内的用药记录 |
| `feedingIntervals` | 连续喂养之间的间隔分钟数（排除 > 720 分钟的间隔） |
| `feedingHeatmap` | 按日期和小时（0-23, 北京时间）聚合的喂养次数 |
| `babyBirthDate` | 婴儿出生日期（北京时间格式 `YYYY-MM-DD`） |

---

### 8.2 获取单日统计数据

获取指定婴儿某一天的统计数据。

- **URL**: `GET /api/stats/day`
- **认证**: 需要
- **限流**: 120 次/60秒

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `babyId` | string | 是 | 婴儿 ID（CUID 格式） |
| `date` | string | 是 | 日期，格式 `YYYY-MM-DD`（北京时间） |

**成功响应** (`200`):

```json
{
  "date": "2024-01-07",
  "breastFeedingCount": 3,
  "totalBreastDuration": 45,
  "breastBottleCount": 1,
  "totalBreastMilkAmount": 120,
  "formulaCount": 2,
  "totalFormulaAmount": 180,
  "adGiven": true,
  "weight": 5.5,
  "temperature": 36.5
}
```

---

### 8.3 获取单日睡眠摘要

获取指定婴儿某一天的睡眠摘要。跨天的睡眠记录会按北京时间自然日边界（00:00）拆分，只返回属于该天的片段及聚合时长。

- **URL**: `GET /api/sleep-summary`
- **认证**: 需要
- **限流**: 120 次/60秒

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `babyId` | string | 是 | 婴儿 ID（CUID 格式） |
| `date` | string | 是 | 日期，格式 `YYYY-MM-DD`（北京时间） |

**成功响应** (`200`):

```json
{
  "date": "2024-01-12",
  "totalMinutes": 510,
  "count": 2,
  "segments": [
    {
      "id": "cxxxxxxxxxxxxxxxxxxxxxxxx",
      "sleepStart": "2024-01-11T14:00:00.000Z",
      "sleepEnd": "2024-01-11T22:00:00.000Z",
      "segmentStart": "2024-01-11T16:00:00.000Z",
      "segmentEnd": "2024-01-11T22:00:00.000Z",
      "segmentMinutes": 360,
      "quality": "GOOD",
      "note": "睡得很好",
      "isFullRecord": false
    },
    {
      "id": "cyyyyyyyyyyyyyyyyyyyyyyyy",
      "sleepStart": "2024-01-12T12:00:00.000Z",
      "sleepEnd": "2024-01-12T14:00:00.000Z",
      "segmentStart": "2024-01-12T12:00:00.000Z",
      "segmentEnd": "2024-01-12T14:00:00.000Z",
      "segmentMinutes": 120,
      "quality": null,
      "note": null,
      "isFullRecord": true
    }
  ]
}
```

**字段说明**:

| 字段 | 说明 |
|---|---|
| `date` | 查询的日期 |
| `totalMinutes` | 当天所有睡眠片段的总时长（分钟） |
| `count` | 在当天**入睡**的次数（跨天记录只在入睡那天计数，与统计页逻辑一致） |
| `segments[].sleepStart` | 原始记录的完整入睡时间（UTC） |
| `segments[].sleepEnd` | 原始记录的完整醒来时间（UTC） |
| `segments[].segmentStart` | 属于当天的片段起始时间（UTC） |
| `segments[].segmentEnd` | 属于当天的片段结束时间（UTC） |
| `segments[].segmentMinutes` | 片段时长（分钟） |
| `segments[].quality` | 睡眠质量（原始记录值） |
| `segments[].note` | 备注（原始记录值） |
| `segments[].isFullRecord` | `true` 表示整段睡眠完全在当天内（非跨天），`false` 表示跨天已裁剪 |

---

## 9. 时间轴

### 9.1 获取时间轴有效日期

获取指定婴儿有喂养或健康记录的所有日期列表（用于时间轴导航）。

- **URL**: `GET /api/timeline-dates`
- **认证**: 需要
- **限流**: 180 次/60秒

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `babyId` | string | 是 | 婴儿 ID（CUID 格式） |

**成功响应** (`200`):

```json
["2024-01-01", "2024-01-02", "2024-01-05", "2024-01-07"]
```

返回一个字符串数组，每个元素为 `YYYY-MM-DD` 格式的日期（北京时间）。

---

## 10. 站点设置（公开）

### 10.1 查询注册状态

查询当前站点是否允许新用户注册。

- **URL**: `GET /api/site/registration-status`
- **认证**: 不需要（公开接口）

**成功响应** (`200`):

```json
{
  "allowRegistration": true
}
```

---

## 11. 管理员接口

以下接口仅限 `ADMIN` 角色的用户访问。

### 11.1 检查管理员身份

检查当前用户是否为管理员。

- **URL**: `GET /api/admin/check`
- **认证**: 需要

**成功响应** (`200`):

```json
{
  "isAdmin": true
}
```

---

### 11.2 获取站点设置

获取站点设置信息。

- **URL**: `GET /api/admin/settings`
- **认证**: 需要（仅 ADMIN）

**成功响应** (`200`):

```json
{
  "allowRegistration": true
}
```

---

### 11.3 更新站点设置

更新站点设置。

- **URL**: `PUT /api/admin/settings`
- **认证**: 需要（仅 ADMIN）
- **CSRF**: 需要 Origin 校验

**请求体 (JSON)**:

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `allowRegistration` | boolean | 否 | 是否允许新用户注册 |

**成功响应** (`200`):

```json
{
  "success": true
}
```

---

### 11.4 获取用户列表

获取所有用户列表（含关联数据统计）。

- **URL**: `GET /api/admin/users`
- **认证**: 需要（仅 ADMIN）

**成功响应** (`200`):

```json
[
  {
    "id": "cxxxxxxxxxxxxxxxxxxxxxxxx",
    "email": "user@example.com",
    "name": "用户名",
    "role": "USER",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "_count": {
      "babies": 2,
      "feedingRecords": 150,
      "healthRecords": 80
    }
  }
]
```

---

### 11.5 删除用户

删除指定用户及其所有关联数据。管理员不能删除自己。

- **URL**: `DELETE /api/admin/users`
- **认证**: 需要（仅 ADMIN）
- **CSRF**: 需要 Origin 校验

**请求体 (JSON)**:

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `userId` | string | 是 | 要删除的用户 ID（CUID 格式） |

**成功响应** (`200`):

```json
{
  "success": true
}
```

---

### 11.6 修改用户角色

修改指定用户的角色。管理员不能修改自己的角色。

- **URL**: `PUT /api/admin/users`
- **认证**: 需要（仅 ADMIN）
- **CSRF**: 需要 Origin 校验

**请求体 (JSON)**:

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `userId` | string | 是 | 用户 ID（CUID 格式） |
| `role` | string | 是 | 目标角色：`USER` 或 `ADMIN` |

**成功响应** (`200`):

```json
{
  "id": "cxxxxxxxxxxxxxxxxxxxxxxxx",
  "role": "ADMIN"
}
```

---

## 12. 提醒系统

### 12.1 获取提醒规则列表

获取当前用户的所有提醒规则。

- **URL**: `GET /api/reminders`
- **认证**: 需要
- **限流**: 60 次/60秒

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `babyId` | string | 否 | 筛选指定婴儿的规则 |
| `enabled` | string | 否 | `true` 仅启用的，`false` 仅禁用的 |

**成功响应** (`200`):

```json
[
  {
    "id": "cxxxxxxxxxxxxxxxxxxxxxxxx",
    "name": "喂养间隔提醒",
    "babyId": "cxxxxxxxxxxxxxxxxxxxxxxxx",
    "babyName": "宝宝",
    "enabled": true,
    "triggerType": "interval",
    "triggerConfig": {
      "sourceType": "feeding",
      "intervalMinutes": 180,
      "filterCondition": { "type": ["FORMULA", "BREAST_MILK"] }
    },
    "activeSchedule": {
      "windows": [{ "start": "06:00", "end": "23:00" }]
    },
    "advanceMinutes": 10,
    "notifyTitle": "该喂{{babyName}}了",
    "notifyBody": "距离上次喂养已经超过3小时",
    "lastFiredAt": "2026-05-26T10:00:00.000Z",
    "createdAt": "2026-05-25T12:00:00.000Z"
  }
]
```

---

### 12.2 创建提醒规则

创建新的提醒规则。每个用户最多 50 条规则。

- **URL**: `POST /api/reminders`
- **认证**: 需要
- **限流**: 20 次/10分钟
- **CSRF**: 需要 Origin 校验

**请求体 (JSON)**:

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | string | 是 | 规则名称，最长 100 字符 |
| `babyId` | string | 是 | 婴儿 ID（CUID 格式） |
| `triggerType` | string | 是 | 触发器类型：`interval`, `cron`, `event_window` |
| `triggerConfig` | object | 是 | 触发器配置（按类型不同，见下方） |
| `activeSchedule` | object \| null | 否 | 活跃时段配置，null=全天候 |
| `advanceMinutes` | number | 否 | 提前触发分钟数，0-60，默认 0 |
| `notifyTitle` | string | 是 | 通知标题（支持 `{{babyName}}` `{{elapsed}}` `{{ruleName}}` `{{now}}` 变量） |
| `notifyBody` | string | 否 | 通知正文（支持同上变量） |
| `startsAt` | string | 否 | 生效时间，ISO 8601 格式 |
| `expiresAt` | string | 否 | 失效时间，ISO 8601 格式 |

**triggerConfig 按类型**:

**interval（间隔监控）**:
```json
{
  "sourceType": "feeding",
  "intervalMinutes": 180,
  "filterCondition": { "type": ["FORMULA", "BREAST_MILK", "BREAST_MILK_BOTTLE"] }
}
```

**cron（定时循环）**:
```json
{
  "cronExpr": "0 11 * * *"
}
```

**event_window（事件窗口）**:
```json
{
  "anchorTime": "2026-05-26T10:00:00+08:00",
  "windowHours": 48,
  "repeatIntervalMinutes": 480
}
```

**activeSchedule 格式**:
```json
{
  "windows": [{ "start": "06:00", "end": "23:00" }],
  "weekdays": [1, 2, 3, 4, 5, 6, 7]
}
```

**成功响应** (`201`): 返回创建的完整规则对象。

---

### 12.3 更新提醒规则

更新提醒规则（支持部分更新）。

- **URL**: `PUT /api/reminders/:id`
- **认证**: 需要
- **限流**: 30 次/10分钟
- **CSRF**: 需要 Origin 校验

**路径参数**:

| 参数 | 类型 | 说明 |
|---|---|---|
| `id` | string | 规则 ID（CUID 格式） |

**请求体 (JSON)**（所有字段可选）:

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string | 规则名称 |
| `enabled` | boolean | 启用/禁用 |
| `triggerConfig` | object | 触发器配置 |
| `activeSchedule` | object \| null | 活跃时段 |
| `advanceMinutes` | number | 提前触发分钟数 |
| `notifyTitle` | string | 通知标题 |
| `notifyBody` | string \| null | 通知正文 |
| `startsAt` | string \| null | 生效时间 |
| `expiresAt` | string \| null | 失效时间 |

**成功响应** (`200`): 返回更新后的规则对象。

---

### 12.4 删除提醒规则

删除一条提醒规则。

- **URL**: `DELETE /api/reminders/:id`
- **认证**: 需要
- **限流**: 20 次/15分钟
- **CSRF**: 需要 Origin 校验

**路径参数**:

| 参数 | 类型 | 说明 |
|---|---|---|
| `id` | string | 规则 ID（CUID 格式） |

**成功响应** (`200`):

```json
{ "success": true }
```

---

### 12.5 获取执行日志

获取提醒系统的执行日志（仅保留 72 小时，存储在内存中）。

- **URL**: `GET /api/reminders/logs`
- **认证**: 需要
- **限流**: 60 次/60秒

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `ruleId` | string | 否 | 筛选指定规则的日志 |
| `limit` | number | 否 | 返回条数，默认 50，最大 100 |
| `offset` | number | 否 | 分页偏移量，默认 0 |

**成功响应** (`200`):

```json
{
  "logs": [
    {
      "id": "a1b2c3d4",
      "timestamp": 1716700000000,
      "source": "reminder",
      "userId": "cxxxxxxxxxxxxxxxxxxxxxxxx",
      "groupKey": "cxxxxxxxxxxxxxxxxxxxxxxxx",
      "groupLabel": "喂养间隔提醒",
      "status": "success",
      "summary": "喂养间隔提醒 · 该喂宝宝了",
      "meta": {
        "ruleId": "cxxxxxxxxxxxxxxxxxxxxxxxx",
        "triggerType": "interval",
        "babyId": "cxxxxxxxxxxxxxxxxxxxxxxxx",
        "babyName": "宝宝",
        "title": "该喂宝宝了",
        "body": "距离上次喂养已经3小时12分钟",
        "webhookDelivered": true,
        "context": { "elapsedMinutes": 192 }
      }
    }
  ],
  "total": 5,
  "offset": 0,
  "limit": 50
}
```

---

### 12.6 清理执行日志

手动清理提醒执行日志。

- **URL**: `DELETE /api/reminders/logs`
- **认证**: 需要
- **限流**: 10 次/10分钟
- **CSRF**: 需要 Origin 校验

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `ruleId` | string | 否 | 仅清理指定规则的日志，不传则清理全部 |

**成功响应** (`200`):

```json
{ "success": true, "deleted": 5 }
```

---

## 枚举值参考

### 喂养类型 (FeedingType)

| 值 | 说明 |
|---|---|
| `BREAST_MILK` | 亲喂母乳 |
| `BREAST_MILK_BOTTLE` | 瓶喂母乳 |
| `FORMULA` | 配方奶 |
| `SOLID_FOOD` | 辅食 |

### 健康记录类型 (HealthType)

| 值 | 说明 |
|---|---|
| `WEIGHT` | 体重 |
| `HEIGHT` | 身高 |
| `TEMPERATURE` | 体温 |
| `MEDICATION` | 用药 |
| `VACCINE` | 疫苗 |
| `DIAPER` | 尿布 |
| `AD_VITAMIN` | AD 维生素 |
| `SLEEP` | 睡眠 |
| `TOOTH_ERUPTION` | 长牙 |
| `CUSTOM` | 自定义健康记录 |

### 性别 (Gender)

| 值 | 说明 |
|---|---|
| `MALE` | 男 |
| `FEMALE` | 女 |

### 尿布类型 (DiaperType)

| 值 | 说明 |
|---|---|
| `PEE` | 尿 |
| `POOP` | 便 |
| `BOTH` | 混合 |

### 用户角色 (Role)

| 值 | 说明 |
|---|---|
| `USER` | 普通用户 |
| `ADMIN` | 管理员 |

### ID 格式

所有资源 ID 使用 CUID 格式，正则表达式：`/^c[a-z0-9]{20,30}$/`
