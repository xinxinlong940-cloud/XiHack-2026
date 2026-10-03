# 本地生图 / 生视频调用

截图中的两种方式是同一个网关的两类接口：

- 生图：`POST /v1/images/generations`，默认模型 `gpt-image-2`；当前地址填写 `https://api.openai-next.com/v1`
- 生视频：先 `POST /seedance/api/v3/content/generations/tasks` 创建任务，再轮询 `/tasks/{id}`

项目已提供 `backend/media_gen.mjs`（默认入口）和等价的 `backend/media_gen.py`。Node 版本只使用 Node 内置能力，不需要安装依赖，也不会把密钥放到前端。

## 一次性准备

在项目根目录执行：

```powershell
Copy-Item .env.local.example .env.local
notepad .env.local
```

把 `CREDIT_MEDIA_API_KEY=` 后填入平台密钥。密钥只保存在本机 `.env.local`，不要提交到 Git。生图地址填写 `CREDIT_MEDIA_API_BASE_URL=https://api.openai-next.com/v1`；视频若有专用地址，填写 `CREDIT_MEDIA_VIDEO_BASE_URL`。模型名也可在命令行用 `--model` 覆盖。

检查 Node.js：

```powershell
node --version
```

需要 Node.js 18 或更高版本。

## 生成图片

```powershell
node backend/media_gen.mjs image "唐长安西市清晨开市，电影感广角，木质摊棚与行人，历史氛围，16:9"
```

默认输出到 `outputs/image.png`。指定文件名：

```powershell
node backend/media_gen.mjs image "康延站在西市摊位前，写实电影剧照" --size 1536x1024 --output outputs/kangyan-market.png
```

## 生成视频

```powershell
node backend/media_gen.mjs video "唐长安西市开市，镜头从鼓面推向拥挤街市，写实电影风格，连续运动"
```

脚本会提交任务、每 10 秒查询一次，完成后保存到 `outputs/<任务ID>.mp4`。可指定时长、画幅和文件名：

```powershell
node backend/media_gen.mjs video "康延回头看向西市入口，衣袍随风，镜头缓慢推进" --duration 5 --ratio 16:9 --output outputs/k01-shot.mp4
```

## 费用与排错

先用短时长、低分辨率或低质量参数验证提示词，再批量生产；每次请求都会产生平台费用，脚本不会自动重试提交任务。若接口报错，终端会显示 HTTP 状态和接口返回的简短错误信息，不会打印 API key。

若服务返回“模型不存在”，使用平台实际开放的模型名覆盖 `--model`。若视频任务一直未完成，记录终端显示的任务 ID，检查平台控制台；脚本超时不会取消云端任务。
