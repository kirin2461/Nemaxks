// Звуковые уведомления через WebAudio API (oscillator) — без аудиофайлов.
// Короткий двухтональный «динг» (~0.15с), анти-спам: не чаще 1 раза в 2 секунды.

let audioContext: AudioContext | null = null
let soundsEnabled = true
let userHasInteracted = false
let lastPlayedAt = 0

const MIN_INTERVAL_MS = 2000

document.addEventListener('click', () => { userHasInteracted = true }, { once: true })
document.addEventListener('keydown', () => { userHasInteracted = true }, { once: true })

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  return audioContext
}

export function warmupAudioContext(): void {
  if (audioContext?.state === 'suspended') {
    audioContext.resume().catch(() => {})
  }
}

// Двухтональный динг: первая нота короткая, вторая чуть выше и длиннее,
// с экспоненциальным затуханием — звучит как приятный колокольчик.
function playTone(ctx: AudioContext, freq: number, startAt: number, duration: number, volume: number) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'sine'
  osc.frequency.value = freq

  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(startAt)
  osc.stop(startAt + duration + 0.02)
}

const SOUND_TONES: Record<'message' | 'call' | 'system', Array<[number, number, number, number]>> = {
  // [частота, задержка от старта, длительность, громкость]
  message: [
    [880, 0, 0.09, 0.25],
    [1318.5, 0.07, 0.14, 0.2],
  ],
  call: [
    [523.25, 0, 0.15, 0.25],
    [783.99, 0.15, 0.2, 0.25],
  ],
  system: [
    [659.25, 0, 0.12, 0.2],
    [987.77, 0.1, 0.15, 0.18],
  ],
}

export async function playNotificationSound(type: 'message' | 'call' | 'system' = 'message'): Promise<void> {
  if (!soundsEnabled) return
  if (!userHasInteracted) return

  // Анти-спам: не чаще одного звука в 2 секунды
  const now = Date.now()
  if (now - lastPlayedAt < MIN_INTERVAL_MS) return
  lastPlayedAt = now

  try {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') {
      await ctx.resume()
    }

    const startAt = ctx.currentTime + 0.01
    for (const [freq, offset, duration, volume] of SOUND_TONES[type]) {
      playTone(ctx, freq, startAt + offset, duration, volume)
    }
  } catch (e) {
    console.error('Failed to play notification sound:', e)
  }
}

export function setSoundsEnabled(enabled: boolean): void {
  soundsEnabled = enabled
  try {
    localStorage.setItem('notification_sounds_enabled', String(enabled))
  } catch {}
}

export function getSoundsEnabled(): boolean {
  try {
    const stored = localStorage.getItem('notification_sounds_enabled')
    if (stored !== null) {
      soundsEnabled = stored === 'true'
    }
  } catch {}
  return soundsEnabled
}

getSoundsEnabled()
