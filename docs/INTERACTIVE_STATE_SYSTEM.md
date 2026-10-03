# 当前互动状态规则

## 本轮与已体验记录

每次从角色选择开始康延或阿九个人线，重置本轮状态到 schema 默认值，保留 `completed_routes` 已体验记录。路线记录仅标记体验进度，不参与数值或结局判断；重玩不会累计刷分。角色选择通过 `storyFlags.viewpoint` 记录 `kangyan` 或 `ajiu`，会合阶段仍保留该视角。

## 数值范围

保留 `reputation`、`cash`、`risk`、`timePressure`、`relationships` 与既有边界；康延保留 `kangyan.debtBalance`，阿九保留 `ajiu.nameValue`（0—3）。阿郎个人线暂停，取消 `alang.informationValue`；其个人行情记录与撮合经验是剧情设定，不赋予固定分数，也不从未体验线路取得状态。

## 结局判定

- S04-A：END01，六件成交，没有长期合作。
- S04-B：复用 END01 生活收束素材，交易未完成。
- S04-C：当前康延视角且 `reputation >= 60`，或当前阿九视角且 `ajiu.nameValue >= 2`，进入 END03；否则 END02。

阿郎不参与数值门槛，未选择的另一人物也不参与门槛。S04-C 的条件仅判定前置选择产生的信用能否带来真结局，不再要求观看多条线路。分数不足不取消本次协商，仍保留 END02 持续合作结局。

条件数据使用 `all` / `any`、`>=` / `==`，视角匹配用严格相等；不识别的操作符按不满足处理。效果按 schema 上下界收敛。
