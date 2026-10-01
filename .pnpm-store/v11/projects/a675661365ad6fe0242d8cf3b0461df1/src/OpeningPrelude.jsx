import { useEffect, useRef, useState } from 'react'

const DRUM_IMAGE = '/assets/opening/drum-cutout.png'
const MARKET_IMAGE = '/assets/opening/market-plate.png'
const DRUM_AUDIO = '/audio/drum-hit.mp3'
const AMBIENCE_AUDIO = '/audio/market-ambience.mp3'

// Keep the market still while the isolated drum recedes a small distance.
const STAGES = [
  { scale: 1.34, opacity: 0.46, exposure: 0.76, duration: 0 },
  { scale: 1.24, opacity: 0.57, exposure: 0.84, duration: 640 },
  { scale: 1.12, opacity: 0.68, exposure: 0.92, duration: 690 },
  { scale: 1, opacity: 0.78, exposure: 1, duration: 760 },
]
const HIT_VOLUMES = [0.34, 0.43, 0.52]
const RIPPLE_STRENGTHS = [0.8, 1.05, 1.3]

export default function OpeningPrelude({ onFinish }) {
  const [doorOpen, setDoorOpen] = useState(false)
  const [doorFinished, setDoorFinished] = useState(false)
  const [hits, setHits] = useState(0)
  const [impact, setImpact] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const count = useRef(0)
  const locked = useRef(false)
  const audio = useRef(null)
  const audioContext = useRef(null)
  const ambience = useRef(null)
  const canvas = useRef(null)
  const wave = useRef(null)
  const frame = useRef(0)
  const timers = useRef([])
  const stage = STAGES[hits]

  useEffect(() => {
    const openTimer = setTimeout(() => setDoorOpen(true), 750)
    const finishTimer = setTimeout(() => setDoorFinished(true), 2700)
    return () => { clearTimeout(openTimer); clearTimeout(finishTimer) }
  }, [])

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
      audioContext.current?.close().catch(() => {})
      audioContext.current = null
    }
  }, [])

  function playSynthDrum(volume) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return
    const context = audioContext.current ?? new AudioContextClass()
    audioContext.current = context
    context.resume().catch(() => {})
    const now = context.currentTime
    const body = context.createOscillator()
    const bodyGain = context.createGain()
    body.type = 'sine'
    body.frequency.setValueAtTime(138, now)
    body.frequency.exponentialRampToValueAtTime(48, now + 0.32)
    bodyGain.gain.setValueAtTime(0.001, now)
    bodyGain.gain.exponentialRampToValueAtTime(volume * 0.8, now + 0.009)
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.66)
    body.connect(bodyGain).connect(context.destination)
    body.start(now)
    body.stop(now + 0.68)

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
    ctx.ellipse(681, 368, 211, 220, 0, 0, Math.PI * 2)
    ctx.clip()
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
      ctx.strokeStyle = `rgba(246, 225, 188, ${0.4 * alpha})`
      ctx.stroke()
    }
    ctx.restore()
    frame.current = requestAnimationFrame(drawWave)
  }

  function strike(event) {
    if (locked.current || count.current >= 3) return
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
        audio.current.play().catch(() => playSynthDrum(HIT_VOLUMES[next - 1]))
      } catch { playSynthDrum(HIT_VOLUMES[next - 1]) }
    } else playSynthDrum(HIT_VOLUMES[next - 1])
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
      // 760ms pullback, 740ms hold, followed by a 730ms fade to black.
      schedule(() => setLeaving(true), 1500)
      schedule(onFinish, 2230)
    }
  }

  if (!doorFinished) return (
    <main className={'app gate-screen ' + (doorOpen ? 'gate-opening' : '')} aria-label="西市一日，开门入市">
      <div className="gate-market" style={{ backgroundImage: 'url(' + MARKET_IMAGE + ')' }} aria-hidden="true" />
      <div className="gate-light" aria-hidden="true" />
      <div className="gate-floor-light" aria-hidden="true" />
      <div className="gate-leaf gate-leaf-left" aria-hidden="true"><span className="gate-ring" /></div>
      <div className="gate-leaf gate-leaf-right" aria-hidden="true"><span className="gate-ring" /></div>
      <div className="gate-frame" aria-hidden="true" />
      <h1 className="gate-title">西市一日</h1>
      <p className="gate-caption">日中 · 鼓声将起</p>
    </main>
  )

  return (
    <main className={`app opening-screen ${leaving ? 'opening-leaving' : ''}`}
      style={{
        '--drum-scale': stage.scale,
        '--market-opacity': stage.opacity,
        '--scene-exposure': stage.exposure,
        '--stage-duration': `${stage.duration}ms`,
      }}>
      <div className={`opening-artwork ${impact ? `opening-camera-${impact}` : ''}`}>
        <div className="opening-market" style={{ backgroundImage: `url(${MARKET_IMAGE})` }} aria-hidden="true" />
        <div className={`drum-shake ${impact ? `drum-impact-${impact}` : ''}`}>
          <div className="drum-camera">
            <div className="drum-foreground">
              <img src={DRUM_IMAGE} alt="正面朝向观众的鼓" draggable="false" />
              <canvas ref={canvas} className="drum-wave" width={1376} height={768} aria-hidden="true" />
              <button className="drum-hit-area" type="button" aria-label="击鼓" onClick={strike} />
            </div>
          </div>
        </div>
      </div>
      <div className="opening-light" aria-hidden="true" />
      <div className="opening-vignette" aria-hidden="true" />
      <h1 className={`opening-title ${hits >= 2 ? 'opening-title-muted' : ''}`}>西市一日</h1>
      <p className={`opening-prompt ${hits > 0 ? 'opening-prompt-hidden' : ''}`}>点击鼓面，开启你的长安故事</p>
      <div className="opening-fade" aria-hidden="true" />
    </main>
  )
}
