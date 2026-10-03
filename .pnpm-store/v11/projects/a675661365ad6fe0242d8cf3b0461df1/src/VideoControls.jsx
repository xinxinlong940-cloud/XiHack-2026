import { useEffect, useState } from 'react'
import { Maximize, Minimize, Pause, Play, Volume2, VolumeX } from 'lucide-react'

function timestamp(seconds) {
  const value = Number.isFinite(seconds) ? Math.floor(seconds) : 0
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`
}

export default function VideoControls({ videoRef, onPlayRequest }) {
  const [paused, setPaused] = useState(true)
  const [muted, setMuted] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [visible, setVisible] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const stage = video.closest('.cinema-stage')
    let timer
    function reveal() {
      clearTimeout(timer)
      setVisible(true)
      if (!video.paused) timer = setTimeout(() => {
        if (!stage.querySelector('.video-controls')?.contains(document.activeElement)) setVisible(false)
      }, 2500)
    }
    function sync() {
      setPaused(video.paused)
      setMuted(video.muted || video.volume === 0)
      setTime(video.currentTime)
      setDuration(Number.isFinite(video.duration) ? video.duration : 0)
    }
    function playbackChanged() { sync(); reveal() }
    function fullscreenChanged() { setFullscreen(document.fullscreenElement === stage); reveal() }
    const events = ['timeupdate', 'durationchange', 'loadedmetadata', 'volumechange', 'seeked']
    events.forEach(event => video.addEventListener(event, sync))
    ;['play', 'pause', 'ended'].forEach(event => video.addEventListener(event, playbackChanged))
    ;['pointermove', 'pointerdown', 'focusin', 'focusout'].forEach(event => stage.addEventListener(event, reveal))
    document.addEventListener('fullscreenchange', fullscreenChanged)
    sync()
    reveal()
    return () => {
      clearTimeout(timer)
      events.forEach(event => video.removeEventListener(event, sync))
      ;['play', 'pause', 'ended'].forEach(event => video.removeEventListener(event, playbackChanged))
      ;['pointermove', 'pointerdown', 'focusin', 'focusout'].forEach(event => stage.removeEventListener(event, reveal))
      document.removeEventListener('fullscreenchange', fullscreenChanged)
    }
  }, [videoRef])

  function togglePlayback() {
    const video = videoRef.current
    if (video.paused) onPlayRequest()
    else video.pause()
  }
  async function toggleFullscreen() {
    const stage = videoRef.current?.closest('.cinema-stage')
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else if (stage?.requestFullscreen) await stage.requestFullscreen()
      else videoRef.current?.webkitEnterFullscreen?.()
    } catch { setVisible(true) }
  }
  return (
    <div className={`video-controls${visible || paused ? '' : ' video-controls--idle'}`} role="group" aria-label="视频控制">
      <button type="button" title={paused ? '播放' : '暂停'} aria-label={paused ? '播放' : '暂停'} onClick={togglePlayback}>
        {paused ? <Play size={18} /> : <Pause size={18} />}
      </button>
      <button type="button" title={muted ? '恢复声音' : '静音'} aria-label={muted ? '恢复声音' : '静音'} aria-pressed={muted} onClick={() => {
        const video = videoRef.current
        video.muted = !muted
        if (muted && video.volume === 0) video.volume = 1
      }}>
        {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
      <span className="video-controls__time">{timestamp(time)}</span>
      <input aria-label="视频进度" type="range" min="0" max={duration || 1} step="0.1" value={Math.min(time, duration || 1)} disabled={!duration} onChange={event => {
        videoRef.current.currentTime = Number(event.target.value)
        setTime(Number(event.target.value))
      }} />
      <span className="video-controls__time">{timestamp(duration)}</span>
      <button type="button" title={fullscreen ? '退出全屏' : '全屏'} aria-label={fullscreen ? '退出全屏' : '全屏'} onClick={toggleFullscreen}>
        {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
      </button>
    </div>
  )
}
