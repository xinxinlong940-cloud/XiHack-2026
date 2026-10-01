# 《大唐西市》Opening 生图 Prompt 总纲

本文件统一三张关键帧的历史边界与影像语言；单张出图请使用 [DRUM_CLOSEUP.md](DRUM_CLOSEUP.md)、[MARKET_WAKEUP.md](MARKET_WAKEUP.md)、[MARKET_ESTABLISHING.md](MARKET_ESTABLISHING.md) 中的完整 Prompt。三张图是同一段 Opening 的连续空间，不是三个互不相关的古装场景。

## 镜头目的

由鼓的局部进入日中开市的动作，再看到市众渐次活动，最后展开西市整体生活空间。对应《OPENING_REFERENCE.md》§3 的镜头顺序；不在生图阶段加入人物选择 UI 或新剧情。

## 历史依据

- **H 的最小范围**：唐长安存在西市及市场管理空间，见 `docs/HISTORICAL_EVIDENCE.md` HE-01；多来源商旅与物质交流是总体背景，见 HE-10、HE-13。
- **击鼓线索**：`assets/references/opening/OPENING_REFERENCE.md` §2 摘引《唐六典》卷二十和《新唐书·百官志》关于**日中击鼓以会众**的记载。`docs/HISTORICAL_EVIDENCE.md` 尚未单列这项证据；用于对外史实说明前应核对原文版本。不可改写成“清晨击鼓开市”。
- **I／视觉复原**：鼓的具体形制与位置、击鼓者、店铺排列、群体动作、整条街景均是影像推演，并非考古原状。DRUM-01 仅供动作参考，DRUM-02 仅供鼓形与材质参考；不能把唐代腰鼓直接认定为西市开市鼓。MARKET-01／02 仅供空间与街道层次参考，不复制模型或照片。
- 时代只写盛唐／唐玄宗时期／8 世纪前半叶，不添加精确年份。遵守 `PROJECT_CONTEXT.md` §§12–13、31 的 H／I／F 边界。

## 画面描述

同一日中光线下，鼓槌待落的局部、鼓响后逐渐有活动的市肆、最终可感知规模与纵深的西市。木、皮、织物、尘土等材质真实；人物是无名的市场参与者，不赋予身份、对白或具体事件。

## 构图

三镜头共同保持 **16:9**。由局部细节到街道层次，再到整体空间；前景、中景、远景逐步打开。预留字幕与后期叠加空间，生图时不生成文字、招牌内容或 UI。

## 摄影机位置

鼓面旁的近距离机位 → 街道边的人眼高度 → 略高于人眼、仍可落地的宽幅观察机位。避免不可信的无人机俯瞰或突然跳到另一座城市。

## 景别

极近特写 → 中远景 → 大全景。镜头空间与光向连续。

## 光线

自然日中光，局部可有遮挡形成层次；不使用黎明或日出的逆光来暗示“清晨开市”。整体克制，不用舞台追光。

## 色调

低饱和的墨黑、深棕、旧纸米白与少量暗金；暗部保留材质细节，不出现大面积亮金或橙色滤镜。

## 正向 Prompt

> Shared visual direction for each individual frame: photorealistic Tang-period historical cinema, Chang'an West Market as a carefully researched **visual reconstruction**, midday market-opening sequence, believable human scale, tactile aged wood, leather, fabric and dust, natural daylight, restrained cinematic contrast, deep ink black, dark brown, warm off-white and subtle muted antique gold, low saturation, coherent architecture and props across consecutive shots, cinematic photography, realistic faces only where visible, 16:9 widescreen, one continuous world, no legible text. Use the shot-specific prompt for subject and framing.

## Negative Prompt

> anime, manga, game CGI, guofeng illustration, fantasy palace, modern buildings, modern clothing, modern signs, readable invented shop names, plastic surfaces, synthetic skin, AI face, over-smoothed skin, excessive gold, glowing ornament, cyberpunk, neon, sunrise, dawn, empty costume-street set, impossible aerial view, copied museum exhibit, fake historical inscription, text artifacts, watermark, collage, triptych.

## 后续转视频注意事项

- 以三张关键帧建立同一鼓、同一光向和同一市场的连续性；先击鼓，后渐次活动，最后拉开空间，不能把市场突然填满。
- 鼓声、鼓面震动、轻微机位反馈与字幕“日中。”在视频／后期完成；静帧不负责生成声音或可读汉字。约 15–20 秒仅是 `OPENING_REFERENCE.md` §3 的产品节奏建议，并非历史时长。
- 生成视频时检查手指、鼓槌、鼓皮、面容与建筑在帧间是否形变；发现变形应重做或剪辑遮盖。Opening 是前导体验，不是新增剧情节点。
