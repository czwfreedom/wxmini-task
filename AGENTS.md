# Task 小程序项目架构指南

## 技术栈

- 微信小程序原生开发
- TypeScript（严格模式）
- SCSS（全局变量 + Mixin）

## 目录结构

```
miniprogram/
├── assets/style/       # 全局样式：var.scss（变量）、mixin.scss（混入）
├── constant/           # 常量：API路径、错误码、配置、国际化文案
├── core/               # 框架层：SubUI 基类、Network、EventBus、Intent、Login、Context
├── model/              # 数据模型：Entity 实体接口定义
├── pages/              # 页面（平铺，不建子目录）
├── server/             # 服务层：按业务域划分 namespace，结构与 CRUD 放一起
├── storage/            # 本地存储 Key
└── utils/              # 通用工具
```

---

## 一、Entity 实体体系

`miniprogram/model/entity.ts` 提供基础接口层级，**只读，不要改动**，避免出现兼容性问题。

所有新增的数据结构**必须**基于 `Entity` 命名空间派生的接口，但**不要在 `model/entity.ts` 中新增**，而是在各自的 Server namespace 中通过 `extends` 派生。

### 基础接口层级

```
Entity.Id          → { id: string }
Entity.Selectable  → { selected?: boolean }
Entity.SelectableId → Id + Selectable
Entity.Info        → Id + { name, nickname?, deleted? }
Entity.Record      → Id + { selected?, invisible?, letterIndex? }
Entity.Label       → Record + Info + { desc?, hint?, style? }
Entity.Image       → Label + { avatar?, avatarStyle? }
Entity.Option      → Image
```

### 新增实体规范

新实体在各自 Server namespace 中定义，派生于 Entity 基础接口，**不修改 entity.ts**：

```typescript
// miniprogram/server/order.ts
import { Entity } from '../model/entity';

export namespace Order {
  // 新实体派生于已有基础接口
  export interface Info extends Entity.Info, Entity.Selectable {
    category: string;
    sortOrder?: number;
  }
}
```

### 工具方法

- `Entity.toMap(items, key?)` — 数组转 Map
- `Entity.group(items, key?, isKeyArray?)` — 分组
- `Entity.find(items, id, key?)` — 按 ID 查找
- `Entity.getIds(items)` — 提取 ID 列表

---

## 二、Server 服务层规范

服务层代码放在 `miniprogram/server/` 目录下，**按业务域划分文件**，每个文件内定义独立的 namespace，将**数据结构定义与 CRUD 操作放在同一 namespace 内**。

### 命名规范

- namespace 名与文件名一致（首字母大写驼峰）
- 接口命名：`{Namespace}.Info`、`{Namespace}.Record` 等
- CRUD 方法直接在 namespace 内 export

### CRUD 参数规范

增删改接口的参数**不要为参数单独定义 interface**，直接用 `Partial<Info>` 代替：

```typescript
// ✅ 正确：用 Partial<Info>
export async function create(data: Partial<Info>): Promise<number | Info> { ... }
export async function update(data: Partial<Info>): Promise<number> { ... } // 要指定ID

// ❌ 错误：不要为参数单独定义 interface
export interface CreateParams { name: string; category: number; }
export async function create(data: CreateParams): Promise<Info> { ... }
```

### API 返回值规范

**所有 API 函数，如果有返回数据，返回类型统一为 `number | Data`**。出现错误时返回错误码（`number`），由业务调用方自行判断处理。

```typescript
// ✅ 正确：number | Data，错误码由业务方处理
export async function list(date: number): Promise<number | Info[]> { ... }
export async function create(data: Partial<Info>): Promise<number | Info> { ... }
// 无数据返回时只返回 number（错误码或 OK）
export async function update(id: string, patch: Partial<Info>): Promise<number> { ... }

// ❌ 错误：吞掉错误码，调用方无法区分是空列表还是网络错误
export async function list(date: number): Promise<Info[]> {
  const res = await Network.post(...);
  if (res.errcode !== 0) return [];  // 错误码丢失了
  return res.data ?? [];
}
```

### 标准模板

```typescript
// miniprogram/server/order.ts
import { Api } from '../constant/api';
import { Err } from '../constant/error';
import { Network } from '../core/network';
import { Entity } from '../model/entity';

export namespace Order {
  export const enum Status {
    /** 未开始 */
    Pending = 0,
    /** 已完成 */
    Done = 100,
    /** 已取消 */
    Cancelled = 200,
  }

  // 数据结构：派生于 Entity 体系
  export interface Info extends Entity.Info {
    amount: number;
    status: Order.Status;
  }

  // CRUD 方法
  export async function list(page: number, size = 20): Promise<number | Order.Info[]> {
    const res = await Network.post<Order.Info[]>(Api.OrderList, { page, size });
    if (res.errcode !== 0) return res.errcode || Err.Code.Network;
    return res.data ?? [];
  }

  export async function create(data: Partial<Order.Info>): Promise<number | Order.Info> {
    const res = await Network.post<Order.Info>(Api.OrderCreate, data);
    if (res.errcode !== 0) return res.errcode || Err.Code.Network;
    return res.data as Order.Info;
  }

  export async function update(id: string, patch: Partial<Order.Info>): Promise<number> {
    const res = await Network.post<Order.Info>(Api.OrderUpdate, { id, ...patch });
    return res.errcode !== 0 ? res.errcode || Err.Code.Network : Err.Code.OK;
  }
}
```

### API 路径常量

在 `miniprogram/constant/api.ts` 中统一管理：

```typescript
export const Api = {
  // 按模块分组
  OrderList: '/v1/order/list',
  OrderDetail: '/v1/order/detail',
};
```

---

## 三、枚举规范

状态、常量等枚举值放在对应 Entity 所在的 namespace 中，使用 `const enum` 实现，**大写开头、驼峰命名**。

```typescript
// miniprogram/server/order.ts
export namespace Order {
  export const enum Priority {
    /** 低优先级 */
    Low = 1,
    /** 普通 */
    Normal = 2,
    /** 高优先级 */
    High = 3,
    /** 紧急 */
    Urgent = 4,
    /** 极其紧急 */
    Critical = 5,
  }

  export interface Info extends Entity.Info {
    amount: number;
    priority: Order.Priority;
  }
}
```

**要点**：

- `const enum` 编译时内联，零运行时开销
- 枚举成员**大写开头、驼峰命名**（如 `Pending`、`Processing`）
- **每个枚举值必须有明确的中文注释**，说明其含义，用 JSDoc 风格（`/** 注释 */`）
- 放在接口所属的 namespace 内，通过 `Order.Status`、`Order.Priority` 访问

---

## 四、ViewModel 与 Adapter 规范

因为 `setData` 是影响小程序性能的关键，**不要直接把 API 返回的原始数据当作 ViewModel 使用**。需要定义一个轻量的 Adapter 层做转换。

### 核心原则

- ViewModel 使用 `Entity.Record`,`Entity.Label`,`Entity.Image` 或其派生子类表示，**仅包含 UI 渲染需要的字段**
- 每个 SubUI 页面搭配一个**同名的 Adapter**（如 `RoutineUI` ↔ `RoutineAdapter`），负责将 Server 的 `Info` 转为 ViewModel
- UI 无关的字段（`userId`、`transaction`、`createTime` 等）**不得**出现在 VM 中

### 示例

```typescript
// pages/routineAdapter.ts
import { Entity } from '../model/entity';
import { Routine } from '../server/routine';

export namespace RoutineAdapter {
  /** ViewModel，仅包含 UI 渲染需要的字段 */
  export interface Record extends Entity.Label {
    /** 任务详情 */
    detail: string;
    /** 任务分类 */
    category: number;
    /** 任务状态 */
    status: number;
    /** 完成时间 */
    finishTime?: number;
    /** 反馈内容 */
    remark?: string;
  }

  /** 将 Server Info 转为 ViewModel */
  export function toRecord(info: Routine.Info): Record {
    return {
      id: info.id,
      name: info.name,
      detail: info.detail,
      category: info.category,
      status: info.status,
      finishTime: info.finishTime,
      remark: info.remark,
    };
  }
}
```

```typescript
// SubUI 中使用
import { RoutineAdapter } from './routineAdapter';

export class RoutineUI extends SubUI<RoutineUI.Data> {
  public async loadData() {
    const result = await Routine.list(today);
    if (typeof result === 'number') {
      this.abort(result);
      return;
    }
    // 通过 Adapter 转换后再 setData
    const records = result.map(RoutineAdapter.toRecord);
    this.setData({ records, loaded: true });
  }
}
```

---

## 五、SCSS 样式规范

**每个页面的 `.scss` 文件必须引用全局样式变量和 Mixin**，不得硬编码颜色、尺寸等。

```scss
@import '../assets/style/var.scss';
@import '../assets/style/mixin.scss';
```

### var.scss 可用变量

| 变量                    | 值                    | 用途          |
| ----------------------- | --------------------- | ------------- |
| `$main`                 | `#5599f7`             | 主色调        |
| `$foreground-dark`      | `#2d3142`             | 标题/重要文字 |
| `$foreground-sub`       | `#5c6178`             | 次要文字      |
| `$foreground-gray`      | `#949aae`             | 占位符/提示   |
| `$foreground-orange`    | `#ffb74d`             | 待完成/添加   |
| `$foreground-red`       | `#ef5350`             | 高优先级/删除 |
| `$background-white`     | `#fbfcfe`             | 全局暖白背景  |
| `$background-gradient`  | linear-gradient(...)  | 渐变背景      |
| `$border` / `$border2`  | `#e5e6eb` / `#d9d9d9` | 边框          |
| `$background-mask` 系列 | rgba 值               | 遮罩层        |

### mixin.scss 可用 Mixin

| Mixin                                 | 用途                               |
| ------------------------------------- | ---------------------------------- |
| `flex-layout($dir, $justify, $align)` | Flex 居中布局                      |
| `flex-container($color)`              | 全屏纵向 Flex 容器                 |
| `flex-container-inner($color)`        | 全尺寸纵向 Flex 容器               |
| `flex-scaleable-content`              | 可伸缩中间区域（配合 scroll-view） |
| `flex-scaleable-scroll-view`          | 配合可伸缩区域的 scroll-view       |
| `mask($color)`                        | 全屏遮罩                           |
| `clear-button`                        | 清除 button 默认样式               |
| `ellipsis` / `ellipsis-layout`        | 文字溢出省略                       |
| `throttle`                            | CSS animation 节流                 |

### 示例

```scss
@import '../assets/style/var.scss';
@import '../assets/style/mixin.scss';

.my-page {
  @include flex-container($background-white);

  &_header {
    padding: 20rpx 30rpx;
    color: $foreground-dark;
  }

  &_content {
    @include flex-scaleable-content;

    &_item {
      border-bottom: 1rpx solid $border;
      @include ellipsis;
    }
  }
}
```

---

## 六、Page 页面封装规范（SubUI 模式）

**所有新增页面必须将主体逻辑封装在一个继承 `SubUI` 的类中**。Page 自身只作为壳层委托给 SubUI 实例，这样写代码时基本不用考虑特殊的 wx 上下文。

### SubUI 基类能力一览

`miniprogram/core/subUI.ts` 提供 `abstract class SubUI<D>`：

| 能力        | 方法                                                           | 说明                                              |
| ----------- | -------------------------------------------------------------- | ------------------------------------------------- |
| 数据读写    | `setData(data)`, `getData()`                                   | 自动添加 subDataKey 前缀；`_` 开头的 key 为根节点 |
| 快捷设值    | `setKvData(key, v)`, `setKvDatas(...)`                         | 单键或多键设值                                    |
| 事件绑定    | `bindEvent(name, fn)`, `unbindEvent(name)`                     | 动态绑定 WXML 事件到 Page                         |
| 事件总线    | `registerEventBus(ev, fn)`, `postEvent(ev, data)`              | 跨组件/跨页通信                                   |
| 生命周期    | `onShow()`, `onHide()`                                         | 页面显隐感知                                      |
| 资源释放    | `release()`                                                    | 解绑事件、恢复截屏                                |
| UI 交互     | `showLoading()`, `hideLoading()`, `showToast()`, `showModal()` | 快捷 UI                                           |
| 错误处理    | `abort(errcode)`, `abortWith(msg)`                             | 统一错误提示                                      |
| Intent 传参 | `setIntent()`, `getIntent()`                                   | 页面间传参                                        |
| 宿主标识    | `setHostId(id)`                                                | 绑定宿主                                          |
| 向上通信    | `setEventListener(fn)`                                         | 传出事件给外层                                    |

### 文件组织

**页面不建子目录**，所有相关文件平铺在 `pages/` 下，避免同名文件难以定位：

```
pages/
├── index.ts              # 入口页面（壳）
├── indexUI.ts            # 入口页 SubUI
├── index.wxml
├── index.scss
├── index.json
├── routine.ts            # 任务页（壳）
├── routineUI.ts          # 任务页（SubUI 业务逻辑）
├── routineAdapter.ts     # 任务页 ViewModel 转换
├── routine.wxml
├── routine.scss
├── routine.json
```

### 标准页面模板

**所有函数包在 namespace/class 中**，不在 Page 层或 SubUI 层裸露顶层函数。

**Data 接口**：与 SubUI 类放在同一个文件中，定义在 namespace 内（如 `XxxUI.Data`），通过 `static getDefaultData()` 暴露默认值。

**Page 层** (`pages/xxx.ts`):

```typescript
import { XxxUI } from './xxxUI';

Page({
  data: {
    ...XxxUI.getDefaultData(),
  },

  ui: undefined as XxxUI | undefined,

  onLoad() {
    this.ui = new XxxUI(this);
    this.ui.loadData();
  },

  onUnload() {
    this.ui?.release();
  },
});
```

**SubUI 层** (`pages/xxxUI.ts`):

```typescript
import { SubUI } from '../core/subUI';
import { Order } from '../server/order';
import { OrderAdapter } from './orderAdapter';
import { Logger } from '../utils/logger';

export namespace XxxUI {
  export interface Data extends SubUI.Data {
    /** ViewModel，不直接使用 Order.Info */
    items: OrderAdapter.Record[];
    keyword: string;
  }
}

export class XxxUI extends SubUI<XxxUI.Data> {
  public constructor(component: any) {
    super(component);

    // bindEvent 直接传函数名，不需要 bind(this)
    this.bindEvent('onItemTap', this.onItemTap);
  }

  public static getDefaultData(): XxxUI.Data {
    return {
      loaded: false,
      abortMessage: '',
      items: [],
      keyword: '',
    };
  }

  public async loadData() {
    this.showLoading();
    const result = await Order.list(1);
    if (typeof result === 'number') {
      this.abort(result);
      return;
    }
    // 通过 Adapter 转换为 ViewModel
    const items = result.map(OrderAdapter.toRecord);
    this.setData({ items, loaded: true });
    this.hideLoading();
  }

  protected onItemTap(e: WechatMiniprogram.TouchEvent) {
    const { id } = e.currentTarget.dataset;
    Logger.info('onItemTap', id);
  }
}
```

**WXML 模板** (`pages/xxx.wxml`):

```xml
<view class="container">
  <block wx:if="{{loaded}}">
    <view wx:for="{{items}}" wx:key="id" class="item">
      <text>{{item.name}}</text>
    </view>
  </block>
  <view wx:else>
    <text>{{abortMessage}}</text>
  </view>
</view>
```

### 要点

- **所有函数包在 namespace/class 中**：Page 层不写裸函数，SubUI 层不写裸工具函数
- **Data 接口在 namespace 内定义**：`XxxUI.Data extends SubUI.Data`，配合 `static getDefaultData()` 提供初始值
- **ViewModel 不直接使用 Server Info**：通过同名 Adapter（`XxxAdapter`）转换，只保留 UI 需要的字段，减少 setData 开销
- **API 返回值先判错再使用**：`typeof result === 'number'` 区分错误码和数据
- **`bindEvent` 直接传函数名**：`this.bindEvent('onXxx', this.onXxx)`，无需 `.bind(this)`，框架在 `fn.call(this, e)` 中自动绑定上下文
- **`_` 前缀 key**：直接设置到 data 根节点，不添加 subDataKey 前缀
- **多 Tab 场景**：同一页面多个 SubUI 实例，通过不同 `subDataKey` 隔离数据
- **释放顺序**：页面 `onUnload` 时调用 `ui.release()` 清理事件绑定和资源

---

## 七、其他约定

### 命名空间风格

项目使用 TypeScript `namespace` 组织代码，所有核心模块均为 namespace export（`Entity`、`Network`、`SubUI`、`Intent`、`Err`、`Logger` 等）。

### 网络请求

统一使用 `Network.post<T>(url, data, errorToast?)`，返回 `BaseResponse<T>`。网络层自动注入用户认证头、处理 Token 过期。

### 页面间传参

使用 `Intent` 机制（通过 `getApp().intent`），避免 URL 参数过长。

### 日志

使用 `Logger.info/warn/error()` 替代 `console.log`，会自动上报微信 LogManager。

### 错误码

在 `constant/error.ts` 的 `Err.Code` 和 `Err.getMessage()` 中统一管理。
