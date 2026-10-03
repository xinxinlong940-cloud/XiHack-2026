import { useEffect, useRef, useState } from 'react'
import storyText from '../../data/interactive/nodes.json?raw'
import stateSchemaText from '../../data/interactive/state_schema.json?raw'
import kangyanStory from '../../data/characters/character_01/story.md?raw'
import ajiuStory from '../../data/characters/character_02/story.md?raw'
import alangStory from '../../data/characters/character_03/story.md?raw'
import { createInitialState, recordCompletedRoute, resolveChoice } from './storyLogic.js'
import OpeningPrelude from './OpeningPrelude.jsx'

const videoFiles = import.meta.glob('../../assets/video/**/*.{mp4,webm,ogg}', {
  eager: true, query: '?url', import: 'default',
})

const choiceVideos = {
  K01_A: '/video/kangyan/K01/K01-A_v01.mp4',
  K01_B: '/video/kangyan/K01/K01-B_v01.mp4',
  K01_C: '/video/kangyan/K01/K01-C_v01.mp4',
}

function readJson(text, label) {
  try { return { value: JSON.parse(text), error: null } }
  catch { return { value: null, error: `${label} 读取失败，请检查 JSON 格式。` } }
}

const story = readJson(storyText, '剧情数据')
const state = readJson(stateSchemaText, '状态数据')
const nodesById = Object.fromEntries((story.value?.nodes ?? []).map((node) => [node.id, node]))
const identitySources = { kangyan: kangyanStory, ajiu: ajiuStory, alang: alangStory }
const displayNames = { kangyan: '康延', ajiu: '阿九', alang: '阿郎' }
const stateLabels = {
  cash: '金钱', reputation: '信誉', risk: '风险', timePressure: '时间压力',
  'kangyan.debtBalance': '债务', 'ajiu.nameValue': '名字价值',
  'alang.informationValue': '信息价值',
}

function identityFor(character) {
  return identitySources[character]?.match(/- 身份：(.+)/)?.[1]?.trim() ?? '身份资料待补充'
}
function mediaFor(node) {
  if (node.video_placeholder?.startsWith('video/')) return `/${node.video_placeholder}`
  return videoFiles[`../../${node.video_placeholder}`] ?? null
}
function labelForChange({ path, before, after }) {
  const label = stateLabels[path] ?? path
  if (typeof before === 'number' && typeof after === 'number') {
    const difference = after - before
    return `${difference > 0 ? '+' : ''}${difference} ${label}`
  }
  return `${label} 已更新`
}

function StatusPanel({ playerState, character }) {
  const entries = ['cash', 'reputation', 'risk', 'timePressure']
  if (character === 'kangyan') entries.push('kangyan.debtBalance')
  if (character === 'ajiu') entries.push('ajiu.nameValue')
  if (character === 'alang') entries.push('alang.informationValue')
  return (
    <aside className="status-panel" aria-label="玩家状态">
      <h2>当前状态</h2>
      <dl>{entries.map((path) => {
        const value = path.split('.').reduce((part, key) => part?.[key], playerState)
        return <div key={path}><dt>{stateLabels[path]}</dt><dd>{value ?? '—'}</dd></div>
      })}</dl>
      <p>已体验路线：{playerState.completed_routes.length} / 3</p>
    </aside>
  )
}

export default function App() {
  const [screen, setScreen] = useState('home')
  const [nodeId, setNodeId] = useState('P01')
  const [currentCharacter, setCurrentCharacter] = useState(null)
  const [playerState, setPlayerState] = useState(() => state.value ? createInitialState(state.value) : null)
  const [ready, setReady] = useState(false)
  const [mediaFailed, setMediaFailed] = useState(false)
  const [branchVideo, setBranchVideo] = useState(null)
  const branchPlaying = useRef(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [toast, setToast] = useState([])
  const [transitionTitle, setTransitionTitle] = useState('')
  const timers = useRef([])
  const transitioning = useRef(false)
  const node = nodesById[nodeId]

  useEffect(() => () => {
    timers.current.forEach(clearTimeout)
  }, [])
  useEffect(() => {
    setReady(false); setMediaFailed(false); setStatusOpen(false)
    setBranchVideo(null); branchPlaying.current = false
  }, [nodeId])
  function schedule(callback, delay) { timers.current.push(setTimeout(callback, delay)) }


  function goTo(nextId, character = currentCharacter) {
    if (transitioning.current) return
    transitioning.current = true
    const target = nodesById[nextId]
    if (!target) { setNodeId(nextId); setScreen('story'); transitioning.current = false; return }
    setTransitionTitle(target.title)
    schedule(() => {
      setNodeId(nextId)
      setCurrentCharacter(character)
      setScreen('story')
      setReady(false)
      if (target.type === 'ending') {
        setPlayerState((previous) => recordCompletedRoute(previous, character))
      }
    }, 320)
    schedule(() => { setTransitionTitle(''); transitioning.current = false }, 900)
  }
  function choose(choice) {
    if (transitioning.current || branchPlaying.current) return
    const result = resolveChoice(playerState, choice, state.value)
    setPlayerState(result.playerState)
    if (nodeId === 'K01' && choiceVideos[choice.id]) {
      branchPlaying.current = true
      setReady(false)
      setMediaFailed(false)
      setBranchVideo({ url: choiceVideos[choice.id], nextNode: result.nextNode })
      return
    }
    const character = nodeId === 'P01' ? nodesById[result.nextNode]?.character : currentCharacter
    goTo(result.nextNode, character)
    if (result.changes.length) {
      schedule(() => setToast(result.changes.map(labelForChange)), 850)
      schedule(() => setToast([]), 2500)
    }
  }
  function returnToSelection(reset) {
    timers.current.forEach(clearTimeout)
    timers.current = []
    transitioning.current = false
    branchPlaying.current = false
    setBranchVideo(null)
    if (reset) setPlayerState(createInitialState(state.value))
    setNodeId('P01')
    setCurrentCharacter(null)
    setReady(false)
    setToast([])
    setTransitionTitle('')
    setStatusOpen(false)
    setScreen('selection')
  }

  const error = story.error || state.error || (!nodesById.P01 && '缺少起始节点 P01。')
  if (error) return <main className="error-screen"><h1>《大唐西市》</h1><p>{error}</p></main>
  if (screen === 'home' || screen === 'opening') return <OpeningPrelude onFinish={() => setScreen('selection')} />

  if (screen === 'selection') {
    const start = nodesById.P01
    const startVideo = mediaFor(start)
    const hasStartVideo = Boolean(startVideo && !mediaFailed)
    return (
      <main className="app selection-screen">
        {hasStartVideo && <video className="selection-video" src={startVideo} autoPlay muted playsInline controls
          onEnded={() => setReady(true)} onError={() => setMediaFailed(true)} aria-label={start.title} />}
        <header className="selection-header"><p>《大唐西市》 · {start.title}</p><h1>选择你要经历的人生</h1></header>
        {hasStartVideo && !ready ? <p className="selection-wait">片段结束后选择人物</p> : (
        <div className="route-grid">{start.choices.map((choice) => {
          const character = nodesById[choice.next_node]?.character
          return (
            <button className="route-card" key={choice.id} type="button" onClick={() => choose(choice)}>
              <span className="route-card__name">{displayNames[character] ?? choice.text}</span>
              <span className="route-card__identity">{identityFor(character)}</span>
              {playerState.completed_routes.includes(character) && <span className="experience-tag">已体验</span>}
            </button>
          )
        })}</div>)}
        {transitionTitle && <div className="transition-curtain" role="status">{transitionTitle}</div>}
      </main>
    )
  }
  if (!node) return (
    <main className="error-screen"><h1>《大唐西市》</h1><p>找不到剧情节点：{nodeId}</p>
      <button type="button" onClick={() => returnToSelection(false)}>返回人物选择</button>
    </main>
  )

  const videoUrl = branchVideo?.url ?? (node.video_placeholder ? mediaFor(node) : null)
  const hasVideo = Boolean(videoUrl && !mediaFailed)
  const isChoice = node.type === 'choice'
  const isEnding = node.type === 'ending'
  const isK01PublicVideo = node.id === 'K01'
  const showOverlay = !branchVideo && (ready || (!hasVideo && isEnding))
  const chapter = node.character === 'shared' ? '共同篇章' : displayNames[currentCharacter] ?? displayNames[node.character]
  function videoEnded(event) {
    if (branchVideo) { goTo(branchVideo.nextNode); return }
    if (isK01PublicVideo) {
      // Keep M01 mounted at its final frame behind the interactive choices.
      event.currentTarget.pause()
      setReady(true)
      return
    }
    if (node.type === 'linear' && node.next?.[0]) goTo(node.next[0])
    else setReady(true)
  }
  return (
    <main className="app stage-screen">
      <header className="stage-header">
        <span className="stage-header__brand">《大唐西市》</span>
        <span className="stage-meta">{chapter} · {node.id}</span>
        {!isK01PublicVideo && <button className="status-toggle" type="button" aria-expanded={statusOpen} onClick={() => setStatusOpen(!statusOpen)}>状态</button>}
      </header>
      <section className="cinema-stage" aria-label={node.title}>
        {hasVideo ? (
          <video key={branchVideo?.url ?? node.id} className="cinema-video" src={videoUrl} autoPlay muted playsInline controls
            onEnded={videoEnded} onError={() => setMediaFailed(true)} aria-label={node.title} />
        ) : (
          <div className="cinema-placeholder">
            <span>{branchVideo ? '分支视频加载失败，请继续故事' : '影像待接入'}</span><strong>{node.title}</strong><small>{node.id} · DATANG XISHI</small>
          </div>
        )}
        <div className="stage-caption"><span>{node.title}</span>{node.description && <p>{node.description}</p>}</div>
        {!hasVideo && !isEnding && !ready && (
          <button className="playback-continue" type="button" onClick={() => {
            if (branchVideo) { goTo(branchVideo.nextNode); return }
            if (node.type === 'linear' && node.next?.[0]) goTo(node.next[0])
            else setReady(true)
          }}>继续故事</button>
        )}
        {isChoice && showOverlay && (
          <div className="choice-overlay"><p className="choice-overlay__heading">你准备怎么做？</p><div>
            {node.choices.map((choice, index) => (
              <button className="choice-option" type="button" key={choice.id} onClick={() => choose(choice)}>
                <span className="choice-option__letter">{String.fromCharCode(65 + index)}</span><span>{choice.text}</span>
              </button>
            ))}
          </div></div>
        )}
        {isEnding && showOverlay && (
          <div className="ending-overlay">
            <span className="ending-label">END · {node.id}</span><h1>{node.title}</h1>
            {node.description && <p>{node.description}</p>}
            <div className="ending-actions">
              <button type="button" onClick={() => returnToSelection(false)}>返回人物选择</button>
              <button type="button" onClick={() => returnToSelection(true)}>重新开始</button>
            </div>
          </div>
        )}
        {toast.length > 0 && <div className="effect-toast" role="status">{toast.map((line) => <span key={line}>{line}</span>)}</div>}
      </section>
      {statusOpen && !isK01PublicVideo && <StatusPanel playerState={playerState} character={currentCharacter} />}
      {transitionTitle && <div className="transition-curtain" role="status">{transitionTitle}</div>}
    </main>
  )
}
