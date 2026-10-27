// 程序合成的短音效（无音频文件，包体为 0）。Web 的 AudioContext 和微信的 wx.createWebAudioContext()
// 都实现了这里用到的子集：createOscillator / createGain / destination / currentTime。
export interface SynthAudioContext {
  readonly currentTime: number;
  readonly destination: unknown;
  state?: string;
  resume?: () => Promise<void> | void;
  createOscillator(): {
    type: string;
    frequency: { setValueAtTime(v: number, t: number): unknown; exponentialRampToValueAtTime(v: number, t: number): unknown };
    connect(node: unknown): unknown;
    start(t?: number): void;
    stop(t?: number): void;
    disconnect(): void;
    onended: (() => void) | null;
  };
  createGain(): {
    gain: { setValueAtTime(v: number, t: number): unknown; exponentialRampToValueAtTime(v: number, t: number): unknown };
    connect(node: unknown): unknown;
    disconnect(): void;
  };
}

export function playSynth(audio: SynthAudioContext, soundId: string, volume: number): void {
  if (audio.state === 'suspended' && audio.resume) {
    try {
      void Promise.resolve(audio.resume()).catch(() => {});
    } catch {
      // 某些环境 resume 同步抛错，忽略即可
    }
  }
  const parts = soundId.split('_');
  const level = Number(parts[1]) || 1;
  const combo = Math.min(6, Number(parts[2]) || 1);
  const merge = soundId.startsWith('merge');
  const frequency = merge ? 330 * Math.pow(1.12, level) * Math.pow(1.06, combo - 1) : 240;
  // 连合逐渐升调，高连合使用短琶音，音量按音符数收敛。
  const notes = merge && combo >= 3 ? [1, 1.25, 1.5] : [1];
  for (let i = 0; i < notes.length; i++) {
    const start = audio.currentTime + i * 0.055;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency * notes[i], start);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * notes[i] * 1.25, start + 0.12);
    gain.gain.setValueAtTime(0.001, audio.currentTime);
    gain.gain.setValueAtTime(volume / notes.length, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.2);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
}
