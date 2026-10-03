import { useEffect, useRef, useState } from 'react'

const DRUM_IMAGE = '/assets/opening/market-drum.png'
const DRUM_AUDIO = '/audio/drum-hit.mp3'
const AMBIENCE_AUDIO = '/audio/market-ambience.mp3'
const GATE_VIDEO = '/assets/opening/gate-opening.mp4'

// A restrained pullback across three strikes keeps the drum in focus.
const STAGES = [
  { scale: 1.08, exposure: 0.94, duration: 0 },
  { scale: 1.055, exposure: 0.97, duration: 640 },
  { scale: 1.025, exposure: 1, duration: 690 },
  { scale: 1, exposure: 1.04, duration: 760 },
]
const HIT_VOLUMES = [0.34, 0.43, 0.52]
const RIPPLE_STRENGTHS = [0.8, 1.05, 1.3]

export default function OpeningPrelude({ onFinish }) {
  const [gateStarted, setGateStarted] = useState(false)
  const [gateFading, setGateFading] = useState(false)
  const [doorFinished, setDoorFinished] = useState(false)
  const [gateTitleOpacity, setGateTitleOpacity] = useState(1)
  const [hits, setHits] = useState(0)
  const [impact, setImpact] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const count = useRef(0)
  const locked = useRef(false)
  const audio = useRef(null)
  const audioContext = useRef(null)
  const audioTailUntil = useRef(0)
  const completed = useRef(false)
  const drumImage = useRef(null)
  const ambience = useRef(null)
  const canvas = useRef(null)
  const wave = useRef(null)
  const frame = useRef(0)
  const timers = useRef([])
  const gateVideo = useRef(null)
  const gateTransition = useRef(false)
  const gateFailed = useRef(false)
  const drumButton = useRef(null)
  const stage = STAGES[hits]

  function finishGate() {
    if (gateTransition.current) return
    gateTransition.current = true
    gateVideo.current?.pause()
    setGateFading(true)
    schedule(() => { setDoorFinished(true); schedule(() => drumButton.current?.focus({ preventScroll: true }), 0) }, 600)
  }

  function enterMarket() {
    if (gateStarted) return
    setGateStarted(true)
    if (gateFailed.current) { finishGate(); return }
    gateVideo.current?.play().catch(finishGate)
  }

  useEffect(() => {
    const request = new AbortController()
    let sound = null
    let marketSound = null
    const unavailable = () => { audio.current = null }
    fetch(DRUM_AUDIO, { method: 'HEAD', signal: request.signal })
      .then((response) => {
        if (!response.ok || response.headers.get('content-type')?.includes('text/html')) return
        sound = new Audio(DRUM_AUDIO)
        sound.preload = 'auto'
        sound.addEventListener('error', unavailable)
        audio.current = sound
      })
      .catch(() => {})
    fetch(AMBIENCE_AUDIO, { method: 'HEAD', signal: request.signal })
      .then((response) => {
        if (!response.ok || response.headers.get('content-type')?.includes('text/html')) return
        marketSound = new Audio(AMBIENCE_AUDIO)
        marketSound.preload = 'auto'
        marketSound.loop = true
        marketSound.addEventListener('error', () => { ambience.current = null })
        ambience.current = marketSound
      })
      .catch(() => {})
    return () => {
      request.abort()
      timers.current.forEach(clearTimeout)
      cancelAnimationFrame(frame.current)
      sound?.removeEventListener('error', unavailable)
      sound?.pause()
      sound?.removeAttribute('src')
      marketSound?.pause()
      marketSound?.removeAttribute('src')
      audio.current = null
      ambience.current = null
      const context = audioContext.current
      if (context) {
        const remaining = completed.current ? Math.max(0, audioTailUntil.current - context.currentTime) : 0
        setTimeout(() => context.close().catch(() => {}), remaining * 1000)
      }
      audioContext.current = null
    }
  }, [])

  function playSynthDrum(volume, strikeNumber, resonanceOnly = false) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return
    const context = audioContext.current ?? new AudioContextClass()
    audioContext.current = context
    context.resume().catch(() => {})
    const now = context.currentTime
    const decay = [0.85, 1.25, 3.2][strikeNumber - 1]
    audioTailUntil.current = Math.max(audioTailUntil.current, now + decay + 0.1)
    const body = context.createOscillator()
    const bodyGain = context.createGain()
    body.type = 'sine'
    body.frequency.setValueAtTime(resonanceOnly ? 76 : 138, now)
    body.frequency.exponentialRampToValueAtTime([52, 46, 40][strikeNumber - 1], now + 0.32)
    bodyGain.gain.setValueAtTime(0.001, now)
    bodyGain.gain.exponentialRampToValueAtTime(volume * (resonanceOnly ? 0.22 : 0.8), now + 0.009)
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + decay)
    body.connect(bodyGain).connect(context.destination)
    body.start(now)
    body.stop(now + decay + 0.05)
    body.onended = () => { body.disconnect(); bodyGain.disconnect() }

    if (resonanceOnly) return

    const noiseBuffer = context.createBuffer(1, Math.ceil(context.sampleRate * 0.16), context.sampleRate)
    const samples = noiseBuffer.getChannelData(0)
    for (let i = 0; i < samples.length; i += 1) samples[i] = Math.random() * 2 - 1
    const skin = context.createBufferSource()
    const filter = context.createBiquadFilter()
    const skinGain = context.createGain()
    skin.buffer = noiseBuffer
    filter.type = 'lowpass'
    filter.frequency.value = 950
    skinGain.gain.setValueAtTime(volume * 0.35, now)
    skinGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
    skin.connect(filter).connect(skinGain).connect(context.destination)
    skin.start(now)
    skin.stop(now + 0.16)
    skin.onended = () => { skin.disconnect(); filter.disconnect(); skinGain.disconnect() }
  }

  function schedule(callback, delay) {
    timers.current.push(setTimeout(callback, delay))
  }

  function drawWave(now) {
    const surface = canvas.current
    const current = wave.current
    if (!surface || !current) return
    const ctx = surface.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, 1376, 768)
    const elapsed = now - current.started
    if (elapsed >= 670) { wave.current = null; return }
    ctx.save()
    ctx.beginPath()
    ctx.ellipse(659, 362, 236, 278, -0.08, 0, Math.PI * 2)
    ctx.clip()
    // A brief contraction of the skin, followed by a small elastic rebound.
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const image = drumImage.current
    if (!reducedMotion && elapsed < 300 && image?.complete && image.naturalWidth) {
      const phase = elapsed / 300
      const displacement = Math.sin(phase * Math.PI * 2) * Math.exp(-phase * 3) * current.strength
      const scale = 1 - displacement * 0.014
      ctx.save()
      ctx.beginPath()
      ctx.ellipse(659, 362, 220, 260, -0.08, 0, Math.PI * 2)
      ctx.clip()
      ctx.translate(659, 362)
      ctx.scale(scale, scale)
      ctx.drawImage(image, -659, -362, 1376, 768)
      ctx.restore()
      const dent = ctx.createRadialGradient(current.x, current.y, 0, current.x, current.y, 110)
      dent.addColorStop(0, `rgba(35, 22, 12, ${Math.max(0, displacement) * 0.16})`)
      dent.addColorStop(1, 'rgba(35, 22, 12, 0)')
      ctx.fillStyle = dent
      ctx.fillRect(0, 0, 1376, 768)
    }
    for (let ring = 0; ring < 3; ring += 1) {
      if (elapsed < ring * 90) continue
      const progress = (elapsed - ring * 90) / (670 - ring * 90)
      if (progress >= 1) continue
      const radius = 10 + progress * (132 + current.strength * 30)
      const alpha = (1 - progress) ** 1.25 * current.strength
      ctx.beginPath()
      ctx.arc(current.x, current.y, radius + 3, 0, Math.PI * 2)
      ctx.lineWidth = 4
      ctx.strokeStyle = `rgba(30, 22, 17, ${0.28 * alpha})`
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(current.x, current.y, radius, 0, Math.PI * 2)
      ctx.lineWidth = 2.4
      ctx.strokeStyle = `rgba(246, 225, 188, ${0.22 * alpha})`
      ctx.stroke()
    }
    ctx.restore()
    frame.current = requestAnimationFrame(drawWave)
  }

  function strike(event) {
    if (!doorFinished || locked.current || count.current >= 3) return
    locked.current = true
    const next = ++count.current
    const foreground = event.currentTarget.parentElement.getBoundingClientRect()
    const face = event.currentTarget.getBoundingClientRect()
    const clickX = event.detail === 0 ? face.left + face.width / 2 : event.clientX
    const clickY = event.detail === 0 ? face.top + face.height / 2 : event.clientY
    const x = ((clickX - foreground.left) / foreground.width) * 1376
    const y = ((clickY - foreground.top) / foreground.height) * 768

    // Sound starts in the click gesture; missing audio never blocks the visual beat.
    if (audio.current) {
      try {
        audio.current.currentTime = 0
        audio.current.volume = HIT_VOLUMES[next - 1]
        audio.current.play().then(() => playSynthDrum(HIT_VOLUMES[next - 1], next, true))
          .catch(() => playSynthDrum(HIT_VOLUMES[next - 1], next))
      } catch { playSynthDrum(HIT_VOLUMES[next - 1], next) }
    } else playSynthDrum(HIT_VOLUMES[next - 1], next)
    cancelAnimationFrame(frame.current)
    wave.current = { x, y, started: performance.now(), strength: RIPPLE_STRENGTHS[next - 1] }
    frame.current = requestAnimationFrame(drawWave)
    setImpact(next)
    setHits(next)
    schedule(() => {
      setImpact(0)
      locked.current = false
    }, 350)

    if (next === 3) {
      if (ambience.current) {
        const sound = ambience.current
        sound.volume = 0
        sound.play().then(() => {
          let step = 0
          const rise = () => {
            if (ambience.current !== sound || step >= 12) return
            step += 1
            sound.volume = Math.min(0.18, step * 0.015)
            schedule(rise, 85)
          }
          rise()
        }).catch(() => {})
      }
      // Let the last resonance carry across the visual transition.
      schedule(() => setLeaving(true), 1000)
      schedule(() => { completed.current = true; onFinish() }, 1900)
    }
  }

  return (
    <main className={`app opening-screen ${leaving ? 'opening-leaving' : ''}`}
      style={{
        '--drum-scale': stage.scale,
        '--scene-exposure': stage.exposure,
        '--stage-duration': `${stage.duration}ms`,
      }}>
      <div className={`opening-artwork ${impact ? `opening-camera-${impact}` : ''}`}>
        <div className={`drum-shake ${impact ? `drum-impact-${impact}` : ''}`}>
          <div className="drum-camera">
            <div className="drum-foreground">
              <img ref={drumImage} src={DRUM_IMAGE} alt="暖光下的西市大鼓" draggable="false" />
              <canvas ref={canvas} className="drum-wave" width={1376} height={768} aria-hidden="true" />
              <button ref={drumButton} className="drum-hit-area" type="button" aria-label="击鼓" disabled={!doorFinished || hits === 3} onClick={strike} />
            </div>
          </div>
        </div>
      </div>
      <div className="opening-light" aria-hidden="true" />
      <div className="opening-vignette" aria-hidden="true" />
      <p className={`opening-prompt ${!doorFinished || hits === 3 ? 'opening-prompt-hidden' : ''}`} aria-live="polite">
        {hits === 0 ? '击鼓入市' : hits === 1 ? '再击一声' : '最后一声，入长安'}
      </p>
      {!doorFinished && <section className={`gate-screen gate-overlay ${gateStarted ? 'gate-started' : ''} ${gateFading ? 'gate-fading' : ''}`} aria-label="西市一日，开门入市">
        <div className="gate-film-frame">
        <video ref={gateVideo} className="gate-video" src={GATE_VIDEO} muted playsInline preload="auto"
          onTimeUpdate={(event) => setGateTitleOpacity(Math.max(0, 1 - (event.currentTarget.currentTime - 0.6) / 2))}
          onEnded={finishGate} onError={() => { gateFailed.current = true; if (gateStarted) finishGate() }}
          aria-label="开门入市" />
        <div className="gate-vignette" aria-hidden="true" />
        <div className="gate-film-heading" style={{ opacity: Math.min(1, gateTitleOpacity) }}>
          <h1 className="gate-film-title">西市一日</h1>
          <p className="gate-film-brand">《大唐西市》</p>
        </div>
        <button className="gate-enter" type="button" disabled={gateStarted} onClick={enterMarket}>进入西市</button>
        </div>
        {gateStarted && !gateFading && <button className="gate-skip" type="button" onClick={finishGate}>跳过开场</button>}
      </section>}
      <div className="opening-fade" aria-hidden="true" />
    </main>
  )
}
