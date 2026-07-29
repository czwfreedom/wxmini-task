# Task 小程序项目架构指南

## 技术栈

微信小程序原生 + TypeScript（严格模式）+ SCSS（全局变量 + Mixin）

## 目录结构

```
miniprogram/
├── assets/style/     # 全局样式 var.scss / mixin.scss
├── constant/         # API路径、错误码、配置
├── core/             # SubUI基类、Network、EventBus、Intent、Login、Context
├── model/            # Entity实体接口（只读勿改）
├── pages/            # 页面平铺，不建子目录：{name}.ts/.wxml/.scss/.json/.UI.ts/Adapter.ts
├── server/           # 按业务域分 namespace，结构+CRUD 放一起
├── storage/          # 本地存储 Key
└── utils/            # 通用工具
```

---

## 一、Entity 实体体系

`model/entity.ts` **只读勿改**。新增接口在各自 Server namespace 中 `extends` 派生。

### 基础接口层级

| 接口                  | 继承            | 附加字段                              |
| --------------------- | --------------- | ------------------------------------- |
| `Entity.Id`           | -               | `id: string`                          |
| `Entity.Selectable`   | -               | `selected?: boolean`                  |
| `Entity.SelectableId` | Id + Selectable | -                                     |
| `Entity.Info`         | Id              | `name, nickname?, deleted?`           |
| `Entity.Record`       | Id              | `selected?, invisible?, letterIndex?` |
| `Entity.Label`        | Record + Info   | `desc?, hint?, style?` (文本VM)       |
| `Entity.Image`        | Label           | `avatar?, avatarStyle?` (带图VM)      |

### 工具方法

`toMap`(数组→Map) · `group`(分组) · `find`(按ID查找) · `getIds`(提取ID列表)

---

## 二、Server 服务层

按业务域分文件，namespace 同名（首字母大写驼峰），数据结构 + CRUD 放同一 namespace。

### CRUD 规范

- **参数**：直接用 `Partial<Info>`，不单独定义 interface
- **返回值**：`number | Data` 或 `number`，**严禁吞错误码**
- **API 路径**：在 `constant/api.ts` 统一管理

### 标准模板

```typescript
// miniprogram/server/order.ts
import { Entity } from '../model/entity';

export namespace Order {
  export const enum Status {
    /** 未开始 */ Pending = 0,
    /** 已完成 */ Done = 100,
    /** 已取消 */ Cancelled = 200,
  }

  export interface Info extends Entity.Info {
    amount: number;
    status: Order.Status;
  }

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

---

## 三、枚举规范

放在 Entity 所在 namespace 内，使用 `const enum`（编译时内联）。

**要点**：大写驼峰 · 每值 `/** 中文注释 */` · 通过 `Namespace.Status` 访问

---

## 四、ViewModel 与 Adapter

**禁止把 API 原始数据直接当 ViewModel 使用**。通过 Adapter 加载 + 转换。

- VM 基于 `Entity.Label/Image/Record` 派生，**仅含 UI 渲染字段**
- VM 接口定义在 `namespace XxxUI` 内（`XxxUI.Data extends SubUI.Data`）
- 每个 SubUI 配同名 Adapter（`RoutineUI` ↔ `RoutineAdapter`）：`load()` 获取数据，`adapt()` 转 VM
- UI 无关字段（`userId`、`transaction`、`createTime` 等）**禁止**出现在 VM

```typescript
// pages/routineUI.ts
import { Entity } from '../model/entity';

export namespace RoutineUI {
  export interface Data extends SubUI.Data {
    items: Record[];
  }
  export interface Record extends Entity.Label {
    detail: string;
    category: number;
  }
}

// pages/routineAdapter.ts
export class RoutineAdapter {
  private infos: Routine.Info[] = [];

  async load(date: number): Promise<number> {
    const result = await Routine.list(date);
    if (typeof result === 'number') return result;
    this.infos = result;
    return Err.Code.OK;
  }

  adapt(): RoutineUI.Record[] {
    return this.infos.map((info) => ({
      id: info.id,
      name: info.name,
      detail: info.detail,
      category: info.category,
    }));
  }
}
```

---

## 五、SCSS 样式

每个 `.scss` **必须**引用全局变量和 Mixin，禁止硬编码颜色/尺寸。

```scss
@import '../assets/style/var.scss';
@import '../assets/style/mixin.scss';
```

### 变量速查

| 变量                             | 值                            | 用途          |
| -------------------------------- | ----------------------------- | ------------- |
| `$main`                          | `#5599f7`                     | 主色调        |
| `$foreground-dark`               | `#2d3142`                     | 标题/重要文字 |
| `$foreground-sub`                | `#5c6178`                     | 次要文字      |
| `$gray-99`                       | `#999999`                     | 占位符/提示   |
| `$background-orange`             | `#f4b942`                     | 待完成/添加   |
| `$foreground-red`                | `#ef5350`                     | 高优先级/删除 |
| `$background-white`              | `#fbfcfe`                     | 暖白背景      |
| `$gray-e5 / $gray-d9 / $gray-c5` | `#e5e5e5 / #d9d9d9 / #c5c5c5` | 边框          |
| `$black*`              | rgba 系列                     | 遮罩          |

### Mixin 速查

`flex-layout(dir,justify,align)` · `flex-container(color)` · `flex-container-inner(color)` · `flex-scaleable-content` · `flex-scaleable-scroll-view` · `mask(color)` · `clear-button` · `ellipsis` / `ellipsis-layout` · `throttle`

### 数据驱动样式

**不写死样式，由数据驱动**。`Entity.Label.style`（`style?: string`）承载样式类名，WXML 动态拼接，SCSS 以 BEM 修饰符定义变体。样式变化由数据层决定，避免在 WXML 中写 `wx:if` 条件分支。

```xml
<!-- WXML: 动态拼接 -->
<view class="entry_content_tip {{ style || '' }}">今日任务</view>
```

```scss
// SCSS: BEM 修饰符
.entry_content_tip {
  color: $foreground-dark;
  &.h {
    color: $foreground-red;
  }
}
```

```typescript
// Data: 数据控制样式
this.setData({ style: 'h' });
```

- `style` 值即 CSS class 名字符串 · 列表项直接复用 VM 自带的 `style` 字段

---

## 六、Page 页面封装（SubUI 模式）

所有新增页面必须封装为继承 `SubUI` 的类，Page 只做壳层委托。

### SubUI 核心 API

| 能力     | 方法                                          | 说明                |
| -------- | --------------------------------------------- | ------------------- |
| 数据     | `setData/getData` / `setKvData/setKvDatas`    | `_`前缀key为根节点  |
| 事件     | `bindEvent/unbindEvent`                       | 动态绑定 WXML 事件  |
| 通信     | `registerEventBus/postEvent`                  | 跨组件/跨页         |
| 生命周期 | `onShow/onHide` / `release`                   | 页面显隐 / 资源释放 |
| 交互     | `showLoading/hideLoading/showToast/showModal` | 快捷 UI             |
| 错误     | `abort(errcode)/abortWith(msg)`               | 统一错误提示        |
| 传参     | `setIntent/getIntent`                         | 页面间传参          |
| 宿主     | `setHostId/setEventListener`                  | 绑定宿主 / 向上通信 |

### 页面文件（平铺，不建子目录,避免同名文件难以定位）

`xxx.ts` (Page壳) · `xxxUI.ts` (SubUI + VM 定义) · `xxxAdapter.ts` (数据转换) · `xxx.wxml/scss/json`

### 标准模板

```typescript
// pages/xxx.ts — Page 壳
import { XxxUI } from './xxxUI';

Page({
  data: { ...XxxUI.getDefaultData() },
  ui: undefined as XxxUI | undefined,
  onLoad() {
    this.ui = new XxxUI(this);
    this.ui.loadData();
  },
  onUnload() {
    this.ui?.release();
  },
});

// pages/xxxUI.ts — SubUI + VM
import { SubUI } from '../core/subUI';
import { Err } from '../constant/error';
import { Entity } from '../model/entity';
import { XxxAdapter } from './xxxAdapter';

export namespace XxxUI {
  export interface Data extends SubUI.Data {
    items: Record[];
    keyword: string;
  }
  export interface Record extends Entity.Label {
    detail: string;
    status: number;
  }
}

export class XxxUI extends SubUI<XxxUI.Data> {
  private adapter = new XxxAdapter();

  constructor(component: any) {
    super(component);
    this.bindEvent('onItemTap', this.onItemTap);
  }

  static getDefaultData(): XxxUI.Data {
    return { loaded: false, abortMessage: '', items: [], keyword: '' };
  }

  async loadData() {
    this.showLoading();
    const errcode = await this.adapter.load();
    if (errcode !== Err.Code.OK) {
      this.abort(errcode);
      return;
    }
    this.setData({ items: this.adapter.adapt(), loaded: true });
    this.hideLoading();
  }

  protected onItemTap(e: WechatMiniprogram.TouchEvent) {
    const { id } = e.currentTarget.dataset;
    Logger.info('onItemTap', id);
  }
}
```

```xml
<!-- pages/xxx.wxml -->
<view class="container">
  <block wx:if="{{loaded}}">
    <view wx:for="{{items}}" wx:key="id" class="item"><text>{{item.name}}</text></view>
  </block>
  <view wx:else><text>{{abortMessage}}</text></view>
</view>
```

### 要点

- 所有函数包在 namespace/class 内，无裸函数
- `bindEvent('onXxx', this.onXxx)` 无需 `.bind(this)`，框架自动绑定
- `_` 前缀 key 绕过 subDataKey，直接设到 data 根节点
- 多 Tab 用不同 `subDataKey` 隔离实例
- `onUnload` 调用 `ui.release()` 释放资源

---

## 七、其他约定

- TypeScript `namespace` 组织代码
- 网络请求：`Network.post<T>(url, data, errorToast?)`，自动注入认证 + 处理 Token 过期
- 页面传参：`Intent` 机制（`getApp().intent`），避免 URL 过长
- 日志：`Logger.info/warn/error()` 替代 `console.log`
- 错误码：`Err.Code` + `Err.getMessage()` 统一管理
