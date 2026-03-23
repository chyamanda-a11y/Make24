# Project Agent Rules

以下规则同步自 [docs/project-overview.md](docs/project-overview.md) 中的 `Technical Constraints` 与 `Engineering Rules`。

## Technical Constraints

- Engine: 必须使用 Cocos Creator 3.x 语法与 API 习惯，避免使用 2.x 风格写法。
- Engine: 数学与向量工具优先使用 3.x 写法，例如 `v3()`，不再使用旧版 `cc.v2()` 风格。
- Engine: Tween 相关实现必须使用 Cocos Creator 3.x 的 `Tween` 体系。
- Decorator: 必须使用标准装饰器写法，例如 `@property({ type: Node })`。
- Memory: 频繁创建和销毁的游戏节点必须评估对象池方案，优先使用 `NodePool` 避免卡顿。
- UI: 必须使用 `UITransform` 获取尺寸相关信息，不直接依赖旧版尺寸接口。
- UI: 多机型适配必须优先通过 `Widget` 和标准布局方式实现。
- Ads: 需要预留微信激励视频广告封装接口，目标能力为 `wx.createRewardedVideoAd`。
- Platform: 任何微信小游戏能力都应先进入平台封装层，不在业务层直接散落调用。

## Engineering Rules

- 每次改动必须可运行：任何一次提交或变更后，项目都应能正常打开和构建。
- 不引入新依赖：除非你明确允许，否则不新增第三方依赖。
- 先写计划再动手：默认输出 `Plan -> Files to change -> Patch`，保证改动可审查。
- 执行前必先确认：接到需求后，先说明理解、实现方式和执行计划，得到你确认后再开始改动。
- 方案前先评估信息缺口：开始设计或实现前，先判断是否存在影响实现质量、交互体验或 Cocos 性能的关键信息缺口。
- 信息缺口提问要收敛：若存在缺口，只一次性提出 `1-5` 个最关键问题；若信息已足够或只是低风险改动，则说明默认假设后继续。
- 信息缺口优先级：问题优先聚焦屏幕比例与适配、操作习惯与交互路径、美术表现、性能预算、平台约束。
- 禁止为了凑数量而提问：只有直接影响设计决策、技术方案或实现成本的问题才应该提出。
- 外部 API 和 SDK 先查现有封装：优先复用项目已有的微信、广告、存档等封装。
- 禁止业务层到处直调 `wx.xxx`：若项目已有平台层，应先接入平台层，再由业务模块调用。
