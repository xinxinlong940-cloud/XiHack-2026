import { useEffect, useRef, useState } from 'react'
import storyText from '../../data/interactive/nodes.json?raw'
import stateSchemaText from '../../data/interactive/state_schema.json?raw'
import { createInitialState, recordCompletedRoute, resolveChoice } from './storyLogic.js'
import OpeningPrelude from './OpeningPrelude.jsx'
import VideoControls from './VideoControls.jsx'
import { CircleGauge, Undo2 } from 'lucide-react'

const videoFiles = import.meta.glob('../../assets/video/**/*.{mp4,webm,ogg}', {
  eager: true, query: '?url', import: 'default',
})

const choiceVideos = {
  K01_A: '/video/kangyan/K01/K01-A_v01.mp4',
  K01_B: '/video/kangyan/K01/K01-B_v01.mp4',
  K01_C: '/video/kangyan/K01/K01-C_v01.mp4',
  K03_A: '/video/kangyan/K03/K03-A_v01.mp4',
  K03_B: '/video/kangyan/K03/K03-B_v01.mp4',
  K03_C: '/video/kangyan/K03/K03-C_v01.mp4',
  J01_A: '/video/ajiu/J01/J01-A.mp4',
  J01_B: '/video/ajiu/J01/J01-B.mp4',
  J01_C: '/video/ajiu/J01/J01-C.mp4',
  J02_A: '/video/ajiu/J02/J02-A.mp4',
  J02_B: '/video/ajiu/J02/J02-B.mp4',
  J02_C: '/video/ajiu/J02/J02-C.mp4',
  J03_A: '/video/ajiu/J03/J03-A.mp4',
  J03_B: '/video/ajiu/J03/J03-B.mp4',
  J03_C: '/video/ajiu/J03/J03-C.mp4',
  J04_A: '/video/ajiu/J04/J04-A.mp4',
  J04_B: '/video/ajiu/J04/J04-B.mp4',
  J04_C: '/video/ajiu/J04/J04-C.mp4',
  K04_A: '/video/kangyan/K04/K04-A.mp4',
  K04_B: '/video/kangyan/K04/K04-B.mp4',
  K04_C_success: '/video/kangyan/K04/K04-C-success.mp4',
  K04_C_failure: '/video/kangyan/K04/K04-C-failure.mp4',
}

function readJson(text, label) {
  try { return { value: JSON.parse(text), error: null } }
  catch { return { value: null, error: `${label} 读取失败，请检查 JSON 格式。` } }
}

const story = readJson(storyText, '剧情数据')
const state = readJson(stateSchemaText, '状态数据')
const nodesById = Object.fromEntries((story.value?.nodes ?? []).map((node) => [node.id, node]))
const displayNames = { kangyan: '康延', ajiu: '阿九' }
const stageTitles = {
  K01: '开远门 · 入长安',
  K03: '西市 · 旧账',
  K04: '绢行 · 赊货',
  J01: '西市 · 留名',
  J02: '西市 · 改样',
  J03: '西市 · 返修',
  J04: '西市 · 接单',
}
const endingSummaries = {
  END01: '你在西市站稳了脚跟。',
  END02: '一笔交易，三种人生由此展开。',
  END03: '你以信用换来了一次长期合作。',
}
const stateLabels = {
  cash: '金钱', reputation: '信誉', risk: '风险', timePressure: '时间压力',
  'kangyan.debtBalance': '债务', 'ajiu.nameValue': '名字价值',
}

function mediaFor(node) {
  if (node.video_placeholder?.startsWith('video/')) return `/${node.video_placeholder}`
  return videoFiles[`../../${node.video_placeholder}`] ?? null
}
function labelForChange({ path, before, after }) {
  const label = stateLabels[path] ?? path
  if (typeof before === 'number' && typeof after === 'number') {
    const difference = after - before
    if (difference === 0) return `${label} 不变`
    const wording = {
      cash: ['增加', '减少'],
      reputation: ['上升', '下降'],
      risk: ['增加', '降低'],
      timePressure: ['增加', '降低'],
      'kangyan.debtBalance': ['增加', '减少'],
      'ajiu.nameValue': ['提升', '降低'],
    }[path] ?? ['上升', '下降']
    return `${label}${difference > 0 ? wording[0] : wording[1]}`
  }
  return `${label} 已更新`
}

function StatusPanel({ playerState, character }) {
  const entries = ['cash', 'reputation', 'risk', 'timePressure']
  if (character === 'kangyan') entries.push('kangyan.debtBalance')
  if (character === 'ajiu') entries.push('ajiu.nameValue')
  return (
    <aside className="status-panel" aria-label="玩家状态">
      <h2>当前状态</h2>
      <dl>{entries.map((path) => {
        const value = path.split('.').reduce((part, key) => part?.[key], playerState)
        return <div key={path}><dt>{stateLabels[path]}</dt><dd>{value ?? '—'}</dd></div>
      })}</dl>
      <p>已体验路线：{playerState.completed_routes.length} / 2</p>
    </aside>
  )
}

export default function App() {
  const [screen, setScreen] = useState('home')
  const [nodeId, setNodeId] = useState('P01')
  const [currentCharacter, setCurrentCharacter] = useState(null)
  const [playerState, setPlayerState] = useState(() => state.value ? createInitialState(state.value) : null)
  const [ready, setReady] = useState(false)
  const [soundBlocked, setSoundBlocked] = useState(false)
  const [completedVideo, setCompletedVideo] = useState(null)
  const [mediaFailed, setMediaFailed] = useState(false)
  const [branchVideo, setBranchVideo] = useState(null)
  const [holdPublicVideo, setHoldPublicVideo] = useState(false)
  const branchPlaying = useRef(false)
  const branchFinishHandled = useRef(false)
  const choiceCheckpoint = useRef(null)
  const returningToChoice = useRef(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [toast, setToast] = useState([])
  const [transitionTitle, setTransitionTitle] = useState('')
  const [transitionRevealing, setTransitionRevealing] = useState(false)
  const transitionTarget = useRef(null)
  const timers = useRef([])
  const activeVideo = useRef(null)
  const transitioning = useRef(false)
  const node = nodesById[nodeId]

  useEffect(() => () => {
    timers.current.forEach(clearTimeout)
  }, [])
  useEffect(() => {
    const restoreChoice = returningToChoice.current
    returningToChoice.current = false
    setReady(restoreChoice); setMediaFailed(false); setStatusOpen(false)
    setCompletedVideo(null)
    setHoldPublicVideo(restoreChoice)
    setBranchVideo(null); branchPlaying.current = false; branchFinishHandled.current = false
  }, [nodeId])
  useEffect(() => {
    setSoundBlocked(false)
    const video = activeVideo.current
    if (!video || holdPublicVideo || (branchVideo && branchVideo.sourceNode !== nodeId)) return
    let active = true
    video.play().catch((error) => {
      if (active && error.name === 'NotAllowedError') setSoundBlocked(true)
    })
    return () => { active = false }
  }, [screen, nodeId, branchVideo, holdPublicVideo])
  function schedule(callback, delay) { timers.current.push(setTimeout(callback, delay)) }

  function playWithSound() {
    const video = activeVideo.current
    if (!video) return
    video.muted = false
    video.play().then(() => setSoundBlocked(false)).catch(() => setSoundBlocked(true))
  }


  function goTo(nextId, character = currentCharacter) {
    if (transitioning.current) return
    transitioning.current = true
    const target = nodesById[nextId]
    if (!target) { setNodeId(nextId); setScreen('story'); transitioning.current = false; return }
    transitionTarget.current = nextId
    setTransitionRevealing(false)
    setTransitionTitle(stageTitles[nextId] ?? target.title)
    schedule(() => {
      // Clear the completed branch in the same render that changes nodes so
      // the next node mounts its own video element and frame immediately.
      setBranchVideo(null)
      branchPlaying.current = false
      setNodeId(nextId)
      setCurrentCharacter(character)
      setScreen('story')
      setReady(false)
      if (target.type === 'ending') {
        setPlayerState((previous) => recordCompletedRoute(previous, character))
      }
      if (!mediaFor(target)) revealTransition(nextId)
    }, 180)
    // A failed or stalled request must never trap the player behind the curtain.
    schedule(() => revealTransition(nextId), 8000)
  }
  function revealTransition(readyNode) {
    if (transitionTarget.current !== readyNode) return
    transitionTarget.current = null
    setTransitionRevealing(true)
    schedule(() => {
      setTransitionTitle('')
      setTransitionRevealing(false)
      transitioning.current = false
    }, 220)
  }
  function videoFrameReady(event) {
    const video = event.currentTarget
    const readyNode = nodeId
    if (transitionTarget.current !== readyNode) return
    if (video.requestVideoFrameCallback && !video.paused) {
      video.requestVideoFrameCallback(() => revealTransition(readyNode))
    } else {
      revealTransition(readyNode)
    }
  }
  function choose(choice) {
    if (transitioning.current || branchPlaying.current) return
    if (nodeId === 'K01' || nodeId === 'J01') {
      choiceCheckpoint.current = { nodeId, playerState, character: currentCharacter }
    }
    const result = resolveChoice(playerState, choice, state.value)
    // A new playable route starts with fresh route values while retaining
    // the player's route history for the selection screen.
    let nextPlayerState = result.playerState
    if (nodeId === 'P01') {
      const routeCharacter = nodesById[result.nextNode]?.character
      if (routeCharacter === 'kangyan' || routeCharacter === 'ajiu') {
        const completedRoutes = playerState.completed_routes ?? []
        nextPlayerState = createInitialState(state.value)
        nextPlayerState.completed_routes = completedRoutes
        nextPlayerState.storyFlags = {
          ...(nextPlayerState.storyFlags ?? {}),
          viewpoint: routeCharacter,
        }
      }
    }
    setPlayerState(nextPlayerState)
    const choiceVideo = nodeId === 'K04' && choice.id === 'K04_C'
      ? choiceVideos[result.conditionMatched ? 'K04_C_success' : 'K04_C_failure']
      : choiceVideos[choice.id]
    if ((nodeId === 'K01' || nodeId === 'K03' || nodeId === 'J01' || nodeId === 'J02' || nodeId === 'J03' || nodeId === 'J04' || nodeId === 'K04') && choiceVideo) {
      branchPlaying.current = true
      branchFinishHandled.current = false
      setHoldPublicVideo(false)
      setReady(false)
      setCompletedVideo(null)
      setMediaFailed(false)
      setBranchVideo({ url: choiceVideo, nextNode: result.nextNode, sourceNode: nodeId })
      return
    }
    const character = nodeId === 'P01' ? nodesById[result.nextNode]?.character : currentCharacter
    goTo(result.nextNode, character)
    if (nodeId !== 'P01' && result.changes.length) {
      schedule(() => setToast(result.changes.map(labelForChange)), 850)
      schedule(() => setToast([]), 2500)
    }
  }
  function returnToSelection(reset) {
    timers.current.forEach(clearTimeout)
    timers.current = []
    transitioning.current = false
    transitionTarget.current = null
    branchPlaying.current = false
    choiceCheckpoint.current = null
    setHoldPublicVideo(false)
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

  function returnToLastChoice() {
    const checkpoint = choiceCheckpoint.current
    if (!checkpoint || transitioning.current) return
    timers.current.forEach(clearTimeout)
    timers.current = []
    transitioning.current = false
    branchPlaying.current = false
    returningToChoice.current = true
    setPlayerState(checkpoint.playerState)
    setCurrentCharacter(checkpoint.character)
    setBranchVideo(null)
    setHoldPublicVideo(true)
    setReady(true)
    setMediaFailed(false)
    setStatusOpen(false)
    setToast([])
    setNodeId(checkpoint.nodeId)
    setScreen('story')
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
        {hasStartVideo && <video ref={activeVideo} className="selection-video" src={startVideo} autoPlay playsInline controls
          onEnded={() => setReady(true)} onError={() => setMediaFailed(true)} aria-label={start.title} />}
        <header className="selection-header"><p>《大唐西市》 · {start.title}</p><h1>选择你要经历的人生</h1></header>
        {hasStartVideo && soundBlocked && <button className="playback-continue" type="button" onClick={playWithSound}>开启声音并播放</button>}
        {hasStartVideo && !ready ? <p className="selection-wait">片段结束后选择人物</p> : (
        <div className="route-grid">{start.choices.map((choice) => {
          const character = nodesById[choice.next_node]?.character
          return (
            <button className={`route-card route-card--${character}`} key={choice.id} type="button" onClick={() => choose(choice)}>
              <span className="route-card__name">{displayNames[character] ?? choice.text}</span>
              <span className="route-card__identity">
                {character === 'kangyan' ? <>粟特商旅中的年轻学徒<br />随货队进入长安<br />在西市凭货物与信用立足</> : <>西市里的年轻匠人<br />在作坊与市集之间磨炼手艺<br />也试着留下自己的名字</>}
              </span>
              {playerState.completed_routes.includes(character) && <span className="experience-tag">已体验</span>}
            </button>
          )
        })}</div>)}
        {transitionTitle && <div className={`transition-curtain${transitionRevealing ? ' transition-curtain--reveal' : ''}`} role="status">{transitionTitle}</div>}
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
  const isJ01PublicVideo = node.id === 'J01'
  const isK03PublicVideo = node.id === 'K03'
  const isChoicePublicVideo = isK01PublicVideo || isJ01PublicVideo
  const canReturnToLastChoice = Boolean(
    choiceCheckpoint.current && (nodeId !== choiceCheckpoint.current.nodeId || branchVideo),
  )
  const showOverlay = !branchVideo && (
    isK03PublicVideo && hasVideo
      ? completedVideo === `${node.id}:${videoUrl}`
      : ready || (!hasVideo && isEnding)
  )
  const chapter = node.character === 'shared' ? '共同篇章' : displayNames[currentCharacter] ?? displayNames[node.character]
  const stageTitle = stageTitles[node.id] ?? node.title
  const endingSummary = node.description || endingSummaries[node.id]
  function videoEnded(event) {
    if (branchVideo) { finishBranchVideo(); return }
    if (isChoicePublicVideo) {
      // Keep the public video mounted at its final frame behind the choices.
      event.currentTarget.pause()
      setReady(true)
      return
    }
    if (isK03PublicVideo) {
      event.currentTarget.pause()
      setCompletedVideo(`${node.id}:${videoUrl}`)
      return
    }
    if (node.type === 'linear' && node.next?.[0]) goTo(node.next[0])
    else setReady(true)
  }
  function finishBranchVideo() {
    if (!branchVideo || branchFinishHandled.current) return
    branchFinishHandled.current = true
    const nextNode = branchVideo.nextNode
    goTo(nextNode)
  }
  function branchVideoProgress(event) {
    const video = event.currentTarget
    if (branchVideo && video.duration > 0 && video.currentTime >= video.duration - 0.15) {
      finishBranchVideo()
    }
  }
  function publicVideoLoaded(event) {
    if (!holdPublicVideo) return
    event.currentTarget.currentTime = event.currentTarget.duration
    event.currentTarget.pause()
  }
  return (
    <main className="app stage-screen">
      <header className="stage-header">
        {canReturnToLastChoice && <button className="back-choice" type="button" onClick={returnToLastChoice} aria-label="返回上个选择"><Undo2 aria-hidden="true" size={15} strokeWidth={1.6} /><span>上个选择</span></button>}
        <span className="stage-header__brand">《大唐西市》</span>
        <span className="stage-meta" title={stageTitle}>{chapter} · {stageTitle}</span>
        {!isK01PublicVideo && <button className="status-toggle" type="button" aria-expanded={statusOpen} onClick={() => setStatusOpen(!statusOpen)}><CircleGauge aria-hidden="true" size={15} strokeWidth={1.6} /><span>状态</span></button>}
      </header>
      <section className="cinema-stage" aria-label={node.title}>
        {hasVideo ? (
          <video ref={activeVideo} key={`${nodeId}:${branchVideo?.url ?? videoUrl}`} className="cinema-video" src={videoUrl} autoPlay={!holdPublicVideo} playsInline
            onLoadedMetadata={isChoicePublicVideo && !branchVideo ? publicVideoLoaded : undefined}
            onPlay={isK03PublicVideo ? () => setCompletedVideo(null) : undefined}
            onSeeking={isK03PublicVideo ? () => setCompletedVideo(null) : undefined}
            onTimeUpdate={branchVideo ? branchVideoProgress : undefined}
            onLoadedData={videoFrameReady}
            onEnded={videoEnded} onError={() => { setMediaFailed(true); revealTransition(nodeId) }} aria-label={node.title} />
        ) : (
          <div className="cinema-placeholder">
            <span>{branchVideo ? '分支视频加载失败，请继续故事' : '影像待接入'}</span><strong>{node.title}</strong><small>{node.id} · DATANG XISHI</small>
          </div>
        )}
        {hasVideo && !showOverlay && <VideoControls key={videoUrl} videoRef={activeVideo} onPlayRequest={playWithSound} />}
        <div key={`${node.id}:${branchVideo ? 'branch' : 'public'}`} className={`stage-caption${branchVideo ? ' stage-caption--branch' : ''}`}>
          <span>{stageTitle}</span>{(node.description || node.synopsis) && <p>{node.description || node.synopsis}</p>}
        </div>
        {hasVideo && soundBlocked && <button className="playback-continue" type="button" onClick={playWithSound}>开启声音并播放</button>}
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
            {endingSummary && <p className="ending-summary">{endingSummary}</p>}
            <div className="ending-actions">
              <button type="button" onClick={() => returnToSelection(false)}>返回人物选择</button>
              <button type="button" onClick={() => returnToSelection(true)}>重新开始</button>
            </div>
          </div>
        )}
        {toast.length > 0 && <div className="effect-toast" role="status">{toast.map((line) => <span key={line}>{line}</span>)}</div>}
      </section>
      {statusOpen && !isK01PublicVideo && <StatusPanel playerState={playerState} character={currentCharacter} />}
      {transitionTitle && <div className={`transition-curtain${transitionRevealing ? ' transition-curtain--reveal' : ''}`} role="status">{transitionTitle}</div>}
    </main>
  )
}
