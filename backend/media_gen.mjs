import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const outputs = path.join(root, 'outputs');

async function loadEnv() {
  for (const name of ['.env.local', '.env']) {
    try {
      const text = await fs.readFile(path.join(root, name), 'utf8');
      for (const line of text.split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
      }
    } catch {}
  }
}

function env(name, fallback = '') {
  const value = (process.env[name] || fallback).trim().replace(/\/$/, '');
  if (!value) throw new Error(`缺少环境变量 ${name}，请填写 .env.local`);
  return value;
}

function first(value, ...keys) {
  if (Array.isArray(value)) for (const item of value) { const found = first(item, ...keys); if (found != null && found !== '') return found; }
  if (value && typeof value === 'object') {
    for (const key of keys) if (value[key] != null && value[key] !== '') return value[key];
    for (const item of Object.values(value)) { const found = first(item, ...keys); if (found != null && found !== '') return found; }
  }
  return null;
}

async function jsonRequest(url, options = {}) {
  const key = env('CREDIT_MEDIA_API_KEY', process.env.AI_API_KEY || '');
  const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${key}`, Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}) } });
  const text = await response.text();
  let data; try { data = JSON.parse(text); } catch { throw new Error(`接口没有返回 JSON: ${text.slice(0, 300)}`); }
  if (!response.ok) throw new Error(`接口返回 HTTP ${response.status}: ${text.slice(0, 1000)}`);
  return data;
}

async function saveRemote(url, file) {
  const key = env('CREDIT_MEDIA_API_KEY', process.env.AI_API_KEY || '');
  const response = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
  if (!response.ok) throw new Error(`下载媒体失败 HTTP ${response.status}`);
  await fs.writeFile(file, Buffer.from(await response.arrayBuffer()));
}

async function dataUrl(file) {
  const absolute = path.resolve(file);
  const bytes = await fs.readFile(absolute);
  const ext = path.extname(absolute).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webm' ? 'video/webm' : 'video/mp4';
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

async function image(prompt, args) {
  const base = env('CREDIT_MEDIA_API_BASE_URL', process.env.AI_API_BASE_URL || 'https://api.openai-next.com/v1');
  const endpoint = base.endsWith('/v1') ? `${base}/images/generations` : `${base}/v1/images/generations`;
  const data = await jsonRequest(endpoint, { method: 'POST', body: JSON.stringify({ model: args.model || process.env.IMAGE_MODEL || 'gpt-image-2', prompt, size: args.size || '1024x1024', quality: args.quality || 'auto' }) });
  await fs.mkdir(outputs, { recursive: true });
  const file = path.resolve(args.output || path.join(outputs, 'image.png'));
  const encoded = first(data, 'b64_json', 'base64'); const url = first(data, 'url', 'image_url', 'download_url');
  if (encoded) await fs.writeFile(file, Buffer.from(encoded, 'base64')); else if (url) await saveRemote(url, file); else throw new Error(`响应里没有图片地址: ${JSON.stringify(data).slice(0, 1000)}`);
  console.log(`图片已保存: ${file}`);
}

async function video(prompt, args) {
  const configured = env('CREDIT_MEDIA_VIDEO_BASE_URL', process.env.CREDIT_MEDIA_API_BASE_URL || 'https://api.openai-next.com');
  const base = configured.replace(/\/v1\/?$/, '');
  const content = [{ type: 'text', text: prompt }];
  for (const file of args.image || []) content.push({ type: 'image_url', image_url: { url: await dataUrl(file) } });
  for (const file of args.video || []) content.push({ type: 'video_url', video_url: { url: await dataUrl(file) } });
  const payload = { model: args.model || process.env.VIDEO_MODEL || 'doubao-seedance-2-0-260128', content: content.length === 1 ? prompt : content };
  if (args.duration) payload.duration = Number(args.duration); if (args.ratio) payload.ratio = args.ratio;
  const created = await jsonRequest(`${base}/seedance/api/v3/content/generations/tasks`, { method: 'POST', body: JSON.stringify(payload) });
  const id = first(created, 'id', 'task_id', 'taskId'); if (!id) throw new Error(`提交成功但没有任务 ID: ${JSON.stringify(created).slice(0, 1000)}`);
  console.log(`任务已提交: ${id}`);
  const interval = Number(args.interval || 10) * 1000; const deadline = Date.now() + Number(args.timeout || 900) * 1000;
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, interval));
    const status = await jsonRequest(`${base}/seedance/api/v3/content/generations/tasks/${encodeURIComponent(id)}`);
    const state = String(first(status, 'status', 'state') || 'unknown').toLowerCase(); console.log(`状态: ${state}`);
    const url = first(status, 'video_url', 'url', 'download_url');
    if (url || ['succeeded', 'success', 'completed', 'done', 'finished'].includes(state)) {
      if (!url) throw new Error(`任务完成但没有视频地址: ${JSON.stringify(status).slice(0, 1000)}`);
      await fs.mkdir(outputs, { recursive: true }); const file = path.resolve(args.output || path.join(outputs, `${id}.mp4`)); await saveRemote(url, file); console.log(`视频已保存: ${file}`); return;
    }
    if (['failed', 'error', 'cancelled', 'canceled'].includes(state)) throw new Error(`视频任务失败: ${JSON.stringify(status).slice(0, 1000)}`);
  }
  throw new Error(`超过 ${args.timeout || 900} 秒仍未完成，任务 ID: ${id}`);
}

function parse(argv) {
  const [command, ...rest] = argv; const flags = {}; const promptParts = [];
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith('--')) {
      const key = rest[i].slice(2); const value = rest[i + 1]?.startsWith('--') ? true : rest[++i];
      if (key === 'image' || key === 'video') (flags[key] ||= []).push(value); else flags[key] = value;
    } else promptParts.push(rest[i]);
  }
  if (!command || !promptParts.length || !['image', 'video'].includes(command)) throw new Error('用法: node backend/media_gen.mjs image|video "提示词" [--model 模型名] [--output 文件]');
  return { command, prompt: promptParts.join(' '), flags };
}

await loadEnv();
try { const { command, prompt, flags } = parse(process.argv.slice(2)); if (command === 'image') await image(prompt, flags); else await video(prompt, flags); }
catch (error) { console.error(`失败: ${error.message}`); process.exitCode = 1; }
