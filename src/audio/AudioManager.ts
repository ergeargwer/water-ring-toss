/**
 * Procedural Web Audio SFX — no external assets required.
 * Button press, water flow, ring collide, success chime.
 */

type Tone = {
  freq: number;
  type: OscillatorType;
  dur: number;
  gain: number;
  freqEnd?: number;
};

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private volume = 0.55;
  private flowNodes: { osc: OscillatorNode; gain: GainNode; filter: BiquadFilterNode } | null =
    null;
  private flowSide: 'left' | 'right' | null = null;

  private ensure(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : this.volume;
  }

  isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master && !this.muted) this.master.gain.value = this.volume;
  }

  /** Soft plastic button click / hydraulic pump tick */
  playButtonPress(strong = false): void {
    const ctx = this.ensure();
    const t = ctx.currentTime;
    this.playTone(
      {
        freq: strong ? 90 : 120,
        type: 'triangle',
        dur: 0.08,
        gain: strong ? 0.22 : 0.15,
        freqEnd: strong ? 55 : 80,
      },
      t
    );
    // short noise burst for pump
    this.playNoise(0.04, strong ? 0.12 : 0.07, 800, t);
  }

  playButtonRelease(): void {
    const ctx = this.ensure();
    this.playTone(
      { freq: 160, type: 'sine', dur: 0.05, gain: 0.06, freqEnd: 100 },
      ctx.currentTime
    );
  }

  /** Continuous water flow — start/stop with side tracking */
  startFlow(side: 'left' | 'right', strong: boolean): void {
    if (this.flowNodes && this.flowSide === side) {
      // update intensity
      const g = strong ? 0.09 : 0.05;
      this.flowNodes.gain.gain.setTargetAtTime(g, this.ensure().currentTime, 0.05);
      return;
    }
    this.stopFlow();
    const ctx = this.ensure();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = strong ? 900 : 600;
    filter.Q.value = 0.6;

    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(strong ? 0.09 : 0.05, ctx.currentTime + 0.08);

    // brown-ish noise via buffer
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.master!);
    noise.start();

    // low hum
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 48;
    const oscGain = ctx.createGain();
    oscGain.gain.value = strong ? 0.03 : 0.015;
    osc.connect(oscGain);
    oscGain.connect(this.master!);
    osc.start();

    this.flowNodes = { osc, gain, filter };
    this.flowSide = side;

    // store noise to stop later — attach to filter for cleanup
    (this.flowNodes as unknown as { noise: AudioBufferSourceNode }).noise = noise;
    (this.flowNodes as unknown as { oscGain: GainNode }).oscGain = oscGain;
  }

  stopFlow(): void {
    if (!this.flowNodes) return;
    const ctx = this.ctx!;
    const nodes = this.flowNodes as unknown as {
      osc: OscillatorNode;
      gain: GainNode;
      noise: AudioBufferSourceNode;
      oscGain: GainNode;
    };
    try {
      nodes.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
      nodes.oscGain?.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
      setTimeout(() => {
        try {
          nodes.noise?.stop();
          nodes.osc?.stop();
        } catch {
          /* already stopped */
        }
      }, 150);
    } catch {
      /* ignore */
    }
    this.flowNodes = null;
    this.flowSide = null;
  }

  playCollision(intensity = 0.5): void {
    const ctx = this.ensure();
    const i = Math.min(1, Math.max(0.1, intensity));
    this.playTone(
      {
        freq: 200 + i * 180,
        type: 'triangle',
        dur: 0.06,
        gain: 0.04 + i * 0.1,
        freqEnd: 80,
      },
      ctx.currentTime
    );
    this.playNoise(0.03, 0.04 * i, 1200, ctx.currentTime);
  }

  playRingScored(): void {
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((f, i) => {
      this.playTone(
        { freq: f, type: 'sine', dur: 0.2, gain: 0.12, freqEnd: f * 1.02 },
        t + i * 0.08
      );
    });
  }

  playVictory(): void {
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const melody = [523.25, 587.33, 659.25, 783.99, 1046.5];
    melody.forEach((f, i) => {
      this.playTone(
        { freq: f, type: 'triangle', dur: 0.28, gain: 0.14, freqEnd: f },
        t + i * 0.12
      );
    });
  }

  playUiClick(): void {
    const ctx = this.ensure();
    this.playTone(
      { freq: 440, type: 'sine', dur: 0.05, gain: 0.08, freqEnd: 660 },
      ctx.currentTime
    );
  }

  private playTone(tone: Tone, when: number): void {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = tone.type;
    osc.frequency.setValueAtTime(tone.freq, when);
    if (tone.freqEnd != null) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, tone.freqEnd),
        when + tone.dur
      );
    }
    g.gain.setValueAtTime(tone.gain, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + tone.dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(when);
    osc.stop(when + tone.dur + 0.02);
  }

  private playNoise(
    dur: number,
    gain: number,
    cutoff: number,
    when: number
  ): void {
    if (!this.ctx || !this.master) return;
    const size = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(when);
    src.stop(when + dur + 0.02);
  }
}

export const audio = new AudioManager();
