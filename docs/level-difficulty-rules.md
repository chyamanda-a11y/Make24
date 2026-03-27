# Make24 关卡难度与筛题规则

本文件将关卡设计语言翻译为 `tools/level-generator` 可执行的特征与约束，避免“体感难度”与“脚本筛题”脱节。

## 1. 难度维度

### 1.1 运算复杂度

- 低：仅 `+`、`*`，无分数中间结果，括号浅
- 中：含 `-`、`/`，但分数不作为主路径
- 高：必须经过分数中间结果，或存在嵌套除法/先减后除

映射字段：

- `usesSubtraction`
- `usesDivision`
- `fractionCount`
- `hasCounterIntuitiveDivision`
- `estimatedSteps`
- `structureDepth`

### 1.2 数字选择策略

- 低：24 的友好因子明显可见，如 `2/3/4/6/8/12`
- 中：引入 `5/7/9/10` 等需要先做差值或补值
- 高：重复数字陷阱、跨度大、假锚点明显

映射字段：

- `maxNumber`
- `minNumber`
- `uniqueNumberCount`
- `surfaceAnchorProfile`
- `isFakeAnchorTrap`

### 1.3 解法唯一性

- 低：多解，容错高
- 中：可行路径有限
- 高：唯一解或高度收敛

映射字段：

- `allSolutionCount`
- `solutionCountBand`

建议分带：

- `unique`: `allSolutionCount === 1`
- `narrow`: `2-3`
- `medium`: `4-8`
- `wide`: `>= 9`

### 1.4 括号与结构嵌套

- 深度 1：`(a+b)*(c+d)` 级别
- 深度 2：`a*(b+c/d)` 或 `a+b*(c-d)`
- 深度 3：`a/(b-c/d)` 或 `a*(b+(c/d))`

映射字段：

- `structureDepth`
- `structureFamily`

## 2. L1-L5 内部难度层

`L1-L5` 作为内部评分语言存在，不直接替换章节结构。章节仍使用 `novice / advanced / challenge` 与 `a / b / c`。

### L1 入门

- 直观锚点可见，如 `3x8`、`4x6`
- 运算以 `+`、`*` 为主
- `allSolutionCount` 通常较高

### L2 基础

- 需要一层括号或简单的加减配合
- 仍围绕明显乘法锚点

### L3 进阶

- 需要放弃第一眼锚点，或开始使用分数中间值
- 重点是“认知切换”而非纯算术复杂度

### L4 复杂

- 结构嵌套深
- 解法高度收敛
- 假锚点明显，错误路径多

### L5 专家

- 唯一解或极低解数
- 分数路径主导
- 结构反直觉但突破后计算量可控

## 3. Surface Anchor / Fake Anchor

### 3.1 表面锚点定义

当前脚本识别以下“第一眼就会尝试”的表面锚点：

- 直接乘出 `24` 的数对，如 `3x8`、`4x6`
- 直接加出 `24` 的数对
- 两组直接加出 `12` 的配对，即“12+12”

映射字段：

- `surfaceAnchorProfile`
- `usesSurfaceAnchor`
- `isFakeAnchorTrap`

### 3.2 假锚点题定义

- 题面存在表面锚点
- dominant solution 不直接消耗这些表面锚点

这类题重点服务于 `advanced-b/c`，用于训练“放弃第一反应并重构路径”。

## 4. 章节阶段目标

### Novice

- `novice-a`: L1，直观锚点与低复杂度
- `novice-b`: L1-L2，引入隐藏中间值，但仍保持宽容错
- `novice-c`: L2-L3，可出现简单除法，但不进入强误导

### Advanced

- `advanced-a`: L2-L3，允许隐藏中间值、简单整除、简单补差值
- `advanced-b`: L3-L4，必须包含一部分假锚点题
- `advanced-c`: L3-L4，假锚点占比更高，并允许更深的结构误导

当前硬约束：

- `advanced-b` 至少 4 题为假锚点题
- `advanced-c` 至少 6 题为假锚点题

### Challenge

- `challenge-a`: L3-L4，允许复杂结构，但不强制分数
- `challenge-b`: L4-L5，优先低解数与分数路径
- `challenge-c`: L5，追求极低解数或近唯一解

当前硬约束：

- `challenge-b` 每题 `allSolutionCount <= 4`
- `challenge-c` 每题 `allSolutionCount <= 2`

## 5. Dominant Solution 选择原则

dominant solution 不再只代表“表达式更干净”，还应代表该 phase 想训练玩家看到的主路径。

当前第一批策略：

- 通过 `humanIntuitionScore` 优待明显锚点与更顺眼的构造
- 在 `advanced-b/c` 中，如果题面有表面锚点，则 dominant 应尽量避开它们
- 在 `challenge-b/c` 中，低解数优先级上升

后续可继续引入：

- `symmetryScore`
- `singleLaneScore`
- 分数路径优雅度
- “整式平替虽然存在但结构丑陋”时对分数主解的豁免规则

## 6. 当前第一批已落地规则

- `humanIntuitionScore`
- `surfaceAnchorProfile`
- `usesSurfaceAnchor`
- `isFakeAnchorTrap`
- `solutionCountBand`
- `advanced-b/c` 假锚点配额
- `challenge-b/c` 低解数约束

## 7. 第二批建议

- 将 dominant solution 改造成 phase-aware，而不是全局唯一排序
- 为 challenge 阶段引入分数路径优雅度与对称性评分
- 为 `advanced-b/c` 增加“dominant 不得直接使用显眼锚点”的逐题硬校验分级
- 为 challenge 增加分母嵌套结构标签，如 `a/(b-c/d)`、`a*(b+c/d)`
