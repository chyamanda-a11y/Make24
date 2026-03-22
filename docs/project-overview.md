# Make24 Project Overview

## Project Goal

Make24 is a lightweight math puzzle game for children aged 8-12. Each level gives the player four numbers. The player combines the numbers two at a time with `+`, `-`, `*`, and `/` until only one result remains. If the final result is `24`, the level is cleared.

This repository is scoped for the first playable release:

- WeChat Mini Game is the only target platform for now.
- The game uses a layered MVC structure.
- The answer feature is simplified: tapping the answer button shows one correct expression directly.
- The result screen is an in-game popup instead of a separate page.

## Runtime Structure

The project keeps the current layered directory layout under `assets/scripts`:

- `assets/scripts/view`: all page views, popup views, and item views
- `assets/scripts/controller`: flow and interaction control logic
- `assets/scripts/model`: runtime state, save data, and level data contracts
- `assets/scripts/core`: shared services and application entry logic

Scene assets stay under `assets/Scene` and only store `.scene` files.

The recommended scene split is:

- `Boot.scene`: initialization, platform detection, save load, and config preload
- `Main.scene`: home page, chapter page, game page, result popup, and answer popup

## MVC Rules

- Model stores data and runtime state. It does not depend on view or controller.
- View owns node references, display updates, button click handlers, and animations only.
- Controller coordinates view input, model updates, save flow, and page switching.
- Core contains application-level services such as routing, save, audio, level loading, and WeChat adaptation.

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

## First-Batch Files

The first batch of scaffold files is intentionally minimal:

- `core/AppController.ts`
- `core/PageRouter.ts`
- `core/LevelService.ts`
- `core/SaveService.ts`
- `core/WXService.ts`
- `core/AudioService.ts`
- `view/home/HomeView.ts`
- `view/chapter/ChapterView.ts`
- `view/chapter/LevelItemView.ts`
- `view/game/GameView.ts`
- `view/game/NumPanelView.ts`
- `view/game/SignPanelView.ts`
- `view/game/ResultPopupView.ts`
- `view/game/AnswerPopupView.ts`
- `controller/home/HomeController.ts`
- `controller/chapter/ChapterController.ts`
- `controller/game/GameController.ts`
- `model/chapter/ChapterModel.ts`
- `model/common/SaveModel.ts`
- `model/game/GameModel.ts`
- `model/game/LevelModel.ts`
- `model/game/StepRecordModel.ts`

## Key Gameplay Data

Each level only needs the fields below in the first version:

```json
{
  "id": 101,
  "chapterId": 1,
  "numbers": [6, 6, 2, 2],
  "answerExpression": "(6*2)*(6/2)"
}
```

The chapter config files currently live under `assets/resources/config/levels/` and are prepared as:

- `chapter_01.json`
- `chapter_02.json`
- `chapter_03.json`

## Current Simplifications

- No graded hint system
- No separate answer controller
- No result popup controller in the first scaffold
- No ad-specific class split yet; WeChat platform access is kept in `WXService`

## Suggested Next Steps

1. Attach `AppController` to the main root node in `Main.scene`.
2. Create page root nodes for home, chapter, and game pages.
3. Bind `HomeView`, `ChapterView`, and `GameView` to those nodes.
4. Fill the three chapter JSON files with the initial level set.
5. Implement the merge calculation flow in `GameController`.
6. Add save and restore logic for continue game.
