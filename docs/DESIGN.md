# Baby Feed 项目设计方案

> 本文档汇总了整个项目的视觉设计、交互规范和功能设计要求，作为项目的整体设计方案参考。

---

## 一、设计方向

| 维度 | 决策 |
|------|------|
| **整体风格** | 现代活泼 — 鲜艳渐变、大圆角、活泼过渡动画 |
| **色调基底** | 清新天蓝（Blue → Cyan）渐变 |
| **视觉感受** | 轻盈通透、色彩丰富但不刺眼、移动端友好 |
| **模式** | 仅亮色模式（强制 light，不支持 dark mode） |
| **目标平台** | PWA 移动端优先（375px+），桌面端自适应 |

---

## 二、色彩系统

### 主色

| 用途 | 色值 | 说明 |
|------|------|------|
| 页面主渐变 | `#3b82f6` → `#06b6d4` | 用于 FAB 按钮、主操作按钮、高亮卡片 |
| PWA 图标渐变 | `#3b82f6` → `#f472b6` | 独立品牌标识，比页面主色更温暖 |

### 背景色

| Token | 色值 | 用途 |
|-------|------|------|
| `--background` | `#f0f9ff` | 页面背景（极浅蓝） |
| 卡片背景 | `#ffffff` | 卡片表面 |
| 次级背景 | `#f1f5f9` | 输入框底色、次级容器 |

### 文字色

| 层级 | 色值 | Tailwind class |
|------|------|---------------|
| 主文字 | `#0f172a` | `text-slate-900` |
| 次级文字 | `#475569` | `text-slate-600` |
| 辅助/禁用 | `#94a3b8` | `text-slate-400` |

### 功能辅助色（每种记录类型专属）

| 类别 | 色彩 | 用途 |
|------|------|------|
| 母乳亲喂 | 粉色 `#ec4899` | Droplets 图标 |
| 母乳瓶喂 | 紫色 `#a855f7` | Milk 图标（区分亲喂） |
| 奶粉 | 蓝色 `#3b82f6` | Milk 图标 |
| AD 滴剂 | 橙色 `#f97316` | Pill 图标 |
| 健康/体重 | 翠绿 `#10b981` | Scale 图标 |
| 身高 | 青色 `#06b6d4` | Ruler 图标 |
| 体温 | 红色 `#ef4444` | Thermometer 图标 |
| 药物 | 紫罗兰 `#8b5cf6` | Pill 图标 |
| 疫苗 | 青绿 `#14b8a6` | Syringe 图标 |
| 尿布 | 琥珀 `#f59e0b` | Baby 图标 |
| 睡眠 | 紫罗兰 `#8b5cf6` | Moon 图标 |
| 辅食 | 橙色 `#f97316` | UtensilsCrossed 图标 |

### 投影系统

| Token | 值 | 用途 |
|-------|------|------|
| `shadow-card` | `0 2px 16px rgba(59,130,246,0.08)` | 普通卡片 |
| `shadow-elevated` | `0 4px 20px rgba(59,130,246,0.25)` | FAB、弹窗、主按钮 |
| `shadow-pressed` | `0 1px 4px rgba(59,130,246,0.12)` | 按下状态 |
| `shadow-nav` | `0 -2px 20px rgba(0,0,0,0.06)` | 底部导航 |

---

## 三、组件规范

### 圆角体系

| 元素 | Token | 值 |
|------|-------|------|
| 卡片 | `rounded-card` | 20px |
| 按钮 | `rounded-button` | 16px |
| 小元素（输入框、标签等） | `rounded-element` | 12px |

### 卡片

- 白底 + `shadow-card` + `border border-blue-50`
- 圆角 20px
- 内边距 `p-3` ~ `p-5`（响应式）

### 按钮

- **主操作按钮**：`gradient-primary`（蓝→青渐变）+ 白色文字 + `shadow-elevated` + `rounded-button`
- **次级按钮**：`bg-slate-100 text-slate-600` + `rounded-button`
- **危险按钮**：`bg-red-50 text-red-600 border border-red-100` + `rounded-button`
- **按下反馈**：`active:scale-[0.98]` 或 `active:scale-95`

### 底部导航栏（移动端）

- 背景：白色毛玻璃 + `rounded-t-[28px]` 顶部圆角
- 活跃项：药丸形背景高亮（`rounded-[15px]` + `from-blue-50 to-sky-50`）+ 填充图标
- 非活跃项：`text-slate-400` + 线条图标
- **中央 FAB 按钮**：**圆形**（`rounded-full`）+ `gradient-primary` + `shadow-elevated` + `ring-4 ring-white`

### 图标风格

- **扁平化**：直接使用彩色图标，**不使用色块背景容器**
- 图标无底色圆圈、无渐变背景包裹
- 图标大小：统计卡片 20px，快捷按钮 22px，记录列表 20px

### 记录类型图标映射

| 类型 | 图标 | 颜色 |
|------|------|------|
| BREAST_MILK（亲喂） | Droplets | pink-500 |
| BREAST_MILK_BOTTLE（瓶喂母乳） | Milk | purple-500 |
| FORMULA（奶粉） | Milk | blue-500 |
| AD_VITAMIN | Pill | orange-500 |
| WEIGHT | Scale | emerald-500 |
| HEIGHT | Ruler | cyan-500 |
| TEMPERATURE | Thermometer | red-500 |
| MEDICATION | Pill | violet-500 |
| VACCINE | Syringe | teal-500 |
| DIAPER | Baby | amber-500 |
| SLEEP | Moon | violet-500 |
| SOLID_FOOD | UtensilsCrossed | orange-500 |

### 表单输入框

- `border border-slate-200 rounded-element`
- 聚焦：`focus:ring-2 focus:ring-blue-400 focus:border-blue-400`
- 字号 16px（防止 iOS 放大）

### 动画与过渡

- 默认过渡：`200ms ease`
- 加载动画：渐变色边框旋转（`border-brand-100 border-t-brand-500`）
- 开屏品牌淡入：`splash-enter 0.5s ease-out`
- Toast 弹入：`toast-in 0.3s ease`

---

## 四、PWA 资产

### 桌面图标

- **形状**：圆角方形（iOS 超椭圆）
- **背景**：Blue → Pink 渐变（`#3b82f6` → `#f472b6`）
- **前景**：白色风格化奶瓶
  - 大圆角瓶身 + 瓶颈 + 奶嘴弧线
  - 下半部粉色半透明奶液填充
  - 中心蓝色半透明爱心
- **填充比例**：约 75%，兼顾小尺寸识别与图标留白
- **尺寸**：72/96/128/144/152/192/384/512（PNG）
- **普通图标**：从对应圆角 SVG 导出，保留透明四角，供 `purpose: any` 与 Apple Touch Icon 使用
- **Maskable 变体**：单独从满版 SVG 导出，主体位于中央安全区域，仅用于 `purpose: maskable`

### 开屏画面

- **背景**：站点浅蓝到淡粉渐变 `#f0f9ff` → `#e0f2fe` → `#fce7f3`
- **浏览器模式**：居中 Logo(76px) + "Baby Feed"(22px/700) + 底部轻量进度条
- **独立 PWA 模式**：只使用系统原生开屏，在首次页面绘制前隐藏网页开屏，避免重复图标与闪烁
- **浏览器动画**：CSS 轻微上移淡入，React 水合后 300ms 淡出
- **无装饰图形**：保持简洁，并提供 `prefers-reduced-motion` 降级

### Manifest

- `theme_color`: `#3b82f6`
- `background_color`: `#f0f9ff`

---

## 五、页面设计要点

### 首页 Dashboard

- 宝宝信息卡：渐变头像背景 + 基本信息
- 统计卡片网格（2列）：扁平彩色图标 + 加粗数字
- 快捷记录按钮（4列）：分类渐变底色 + 扁平彩色图标 + 分类色标签
- 今日记录列表：白底圆角行 + 左侧圆形白底图标容器

### 时间轴 Timeline

- 按日期分组，日期头加粗
- 记录条目：白底 `rounded-element` + 细边框，**无左侧彩色边框**
- 滑动删除/编辑操作

### 统计 Stats

- 分段标签选择器（药丸风格）
- 趋势图表卡片：白底 + `shadow-card` + 分类色边框点缀
- 喂养热力图、体重/身高/BMI趋势线图
- 疫苗进度卡（进度条 + 状态标签）
- 数据洞察卡片

### 设置 Settings

- 分区卡片布局
- **宝宝管理**：每个宝宝卡片右侧一个 **⋮ 更多按钮**（MoreVertical），点击展开下拉菜单：
  - 复制 ID
  - 编辑资料
  - 删除宝宝（红色）
- **API Key 管理**：
  - 顶部 API 文档链接卡片（指向 GitHub HTTP_REQUESTS.md）
  - Key 列表 + 创建/删除
- 危险操作区域：红色边框卡片

### 登录/注册

- 渐变背景（`from-brand-50 via-blue-50 to-pink-50`）
- 居中 Logo 卡片（gradient-icon 背景）
- 白色表单卡片 + `shadow-card`
- 渐变提交按钮

---

## 六、交互规范

### 复制反馈

- **统一使用 `CopyToast` 组件**（`components/CopyToast.tsx`）
- 所有复制操作调用 `useCopyToast().copyToClipboard(text, message)`
- 效果：屏幕顶部居中弹出深色半透明 Toast（✓ + 自定义文字），2 秒自动消失
- 已接入场景：
  - 宝宝 ID 复制 → "宝宝 ID 已复制"
  - API Key 复制 → "API Key 已复制"
  - 邀请链接复制 → "邀请链接已复制"

### 下拉菜单

- 多操作场景（如宝宝管理的复制/编辑/删除）收纳为 ⋮ 按钮 + 下拉菜单
- 避免移动端按钮拥挤
- 点击外部区域自动关闭

### 加载状态

- 旋转环：`border-4 border-brand-100 border-t-brand-500`
- 按钮内文字替换（如"保存中..."）

---

## 七、功能设计

### 邀请注册系统

当管理员关闭公开注册后，通过一次性邀请码邀请新用户：

1. 管理员在站点管理 → 邀请注册 → 生成邀请链接
2. 系统生成 32 位随机 hex 码，自动复制链接到剪贴板
3. 被邀请人打开 `/register?code=xxx`，即使全局注册关闭也能注册
4. 邀请码一次性使用，用后作废
5. 管理员可查看所有邀请码状态（未用/已用/时间）、复制、删除

**技术实现**：复用 `SiteSettings` key-value 表（`invite:<code>` → JSON），无需数据库迁移。

### API 文档入口

API Key 管理页面顶部展示文档链接卡片，指向：
`https://github.com/hxhb/baby-feed/blob/master/docs/HTTP_REQUESTS.md`

---

## 八、技术约束

1. **仅亮色模式** — 强制 `color-scheme: light`
2. **移动端优先** — 375px+ 宽度优化，桌面自适应
3. **无重型依赖** — 所有动画用 CSS transitions/keyframes，不引入动画库
4. **无障碍** — 保持 WCAG AA 对比度，所有交互元素有 `aria-label`
5. **安全区域** — 尊重 `env(safe-area-inset-*)` 适配刘海/Home Indicator
6. **不影响数据层** — 前端设计变更不触动 Prisma schema、API 路由、认证中间件
7. **Tailwind CSS** — 通过 `tailwind.config.ts` 定义设计 token，组件中使用 class 组合

---

## 九、设计 Token 快速参考

```typescript
// tailwind.config.ts
theme: {
  extend: {
    colors: {
      brand: { 50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 500: '#3b82f6', 600: '#2563eb' },
      accent: { breast: '#ec4899', formula: '#3b82f6', ad: '#f97316', health: '#10b981', sleep: '#8b5cf6', diaper: '#f59e0b' },
    },
    borderRadius: { card: '20px', button: '16px', element: '12px' },
    boxShadow: {
      card: '0 2px 16px rgba(59, 130, 246, 0.08)',
      elevated: '0 4px 20px rgba(59, 130, 246, 0.25)',
      pressed: '0 1px 4px rgba(59, 130, 246, 0.12)',
      nav: '0 -2px 20px rgba(0, 0, 0, 0.06)',
    },
  },
}
```

**CSS 工具类**（`globals.css`）：
- `.gradient-primary` — 蓝→青主渐变
- `.gradient-icon` — 蓝→粉图标渐变
- `.gradient-breast/.formula/.ad/.health/.sleep/.diaper` — 分类渐变
- `.splash-screen` / `.splash-brand` — 浏览器开屏画面与品牌淡入动画
- `@media (display-mode: standalone)` — 独立 PWA 首帧跳过网页开屏
- `@keyframes toast-in` — Toast 弹入动画
