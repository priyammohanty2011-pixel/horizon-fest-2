/**
 * Web Audio API synthesizer for Horizon Fest 2 realistic racing sounds:
 * - Engine pitch/RPM audio synthesizer
 * - Tire screech when drifting
 * - Off-track grass rumble
 * - Race countdown beeps (3, 2, 1, GO)
 * - Lap completion victory chime
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  // Engine Synth
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineOsc3: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;

  // Tire Screech Synth
  private screechSource: AudioBufferSourceNode | null = null;
  private screechGain: GainNode | null = null;
  private screechFilter: BiquadFilterNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  // Off-road Grass Rumble
  private rumbleOsc: OscillatorNode | null = null;
  private rumbleGain: GainNode | null = null;

  private isRunning: boolean = false;
  private lastThrottle: number = 0;
  private lastRpm: number = 0;

  constructor() {
    // AudioContext will be initialized on user interaction
  }

  public init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.createNoiseBuffer();
      this.setupEngineSynth();
      this.setupScreechSynth();
      this.setupRumbleSynth();
      this.isRunning = true;
    } catch {
      // AudioContext not supported or restricted
    }
  }

  private createNoiseBuffer() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2;
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Pink noise approximation for realistic tire scrub
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
    }
  }

  private setupEngineSynth() {
    if (!this.ctx) return;
    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc3 = this.ctx.createOscillator();
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineGain = this.ctx.createGain();

    // V8 / V10 racing engine harmonics
    this.engineOsc1.type = 'sawtooth'; // Raw exhaust pulse
    this.engineOsc2.type = 'triangle'; // Sub-cylinder displacement
    this.engineOsc3.type = 'sawtooth'; // High-rev intake scream
    this.engineOsc1.frequency.setValueAtTime(50, this.ctx.currentTime);
    this.engineOsc2.frequency.setValueAtTime(100, this.ctx.currentTime);
    this.engineOsc3.frequency.setValueAtTime(150, this.ctx.currentTime);

    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(280, this.ctx.currentTime);
    this.engineFilter.Q.setValueAtTime(3.0, this.ctx.currentTime);

    this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineOsc3.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);

    this.engineOsc1.start();
    this.engineOsc2.start();
    this.engineOsc3.start();
  }

  private setupScreechSynth() {
    if (!this.ctx || !this.noiseBuffer) return;
    this.screechGain = this.ctx.createGain();
    this.screechGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.screechFilter = this.ctx.createBiquadFilter();
    this.screechFilter.type = 'bandpass';
    this.screechFilter.frequency.setValueAtTime(1200, this.ctx.currentTime);
    this.screechFilter.Q.setValueAtTime(4.5, this.ctx.currentTime);

    this.screechFilter.connect(this.screechGain);
    this.screechGain.connect(this.ctx.destination);

    this.screechSource = this.ctx.createBufferSource();
    this.screechSource.buffer = this.noiseBuffer;
    this.screechSource.loop = true;
    this.screechSource.connect(this.screechFilter);
    this.screechSource.start();
  }

  private setupRumbleSynth() {
    if (!this.ctx) return;
    this.rumbleOsc = this.ctx.createOscillator();
    this.rumbleOsc.type = 'triangle';
    this.rumbleOsc.frequency.setValueAtTime(35, this.ctx.currentTime);

    this.rumbleGain = this.ctx.createGain();
    this.rumbleGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.rumbleOsc.connect(this.rumbleGain);
    this.rumbleGain.connect(this.ctx.destination);
    this.rumbleOsc.start();
  }

  public updateEngine(rpmNormalized: number, throttle: number, speed: number, isDrifting: boolean, isOffroad: boolean) {
    if (!this.ctx || this.isMuted || !this.isRunning) return;

    const now = this.ctx.currentTime;

    // Detect sudden throttle lift at high RPM -> turbo blow-off valve
    if (this.lastThrottle > 0.7 && throttle < 0.2 && this.lastRpm > 0.6) {
      this.playBlowOff();
    }
    this.lastThrottle = throttle;
    this.lastRpm = rpmNormalized;

    // Rev limiter stutter (bouncing off the limiter: tat-tat-tat)
    let effectiveRpm = rpmNormalized;
    if (effectiveRpm > 0.94 && throttle > 0.8) {
      const limiterStutter = (Math.sin(now * 55) > 0 ? 0 : -0.08);
      effectiveRpm = Math.max(0.85, effectiveRpm + limiterStutter);
    }

    // Pitch: from idle 48Hz to screaming redline 380Hz
    const baseFreq = 48 + effectiveRpm * 260 + (speed / 400) * 55;
    if (this.engineOsc1 && this.engineOsc2 && this.engineOsc3) {
      this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.035);
      this.engineOsc2.frequency.setTargetAtTime(baseFreq * 1.5, now, 0.035);
      this.engineOsc3.frequency.setTargetAtTime(baseFreq * 2.25, now, 0.035);
    }

    if (this.engineFilter) {
      // Filter opens up wide under throttle for aggressive intake roar
      const cutoff = 280 + effectiveRpm * 900 + throttle * 600;
      this.engineFilter.frequency.setTargetAtTime(cutoff, now, 0.04);
    }

    if (this.engineGain) {
      const vol = Math.min(0.26, 0.07 + throttle * 0.14 + (speed / 400) * 0.06);
      this.engineGain.gain.setTargetAtTime(vol, now, 0.04);
    }

    // Tire Screech volume
    if (this.screechGain && this.screechFilter) {
      const screechVol = isDrifting && speed > 40 ? Math.min(0.28, 0.10 + (speed / 400) * 0.18) : 0;
      this.screechGain.gain.setTargetAtTime(screechVol, now, 0.03);
      this.screechFilter.frequency.setTargetAtTime(1150 + (speed / 400) * 550, now, 0.04);
    }

    // Grass Rumble volume
    if (this.rumbleGain && this.rumbleOsc) {
      const rumbleVol = isOffroad && speed > 25 ? Math.min(0.22, (speed / 300) * 0.18) : 0;
      this.rumbleGain.gain.setTargetAtTime(rumbleVol, now, 0.05);
      this.rumbleOsc.frequency.setTargetAtTime(30 + (speed / 300) * 35, now, 0.05);
    }
  }

  public playShiftPop() {
    if (!this.ctx || this.isMuted || !this.isRunning) return;
    this.init();
    const now = this.ctx.currentTime;

    // 1. Low bass backfire punch
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(120, now);
    subOsc.frequency.exponentialRampToValueAtTime(32, now + 0.09);
    subGain.gain.setValueAtTime(0.35, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.11);

    // 2. High exhaust crackle / snap
    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(1100, now);
      noiseFilter.Q.setValueAtTime(2.5, now);
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.30, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      noise.start(now);
      noise.stop(now + 0.09);
    }
  }

  public playBlowOff() {
    if (!this.ctx || this.isMuted || !this.isRunning || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3200, now);
    filter.frequency.exponentialRampToValueAtTime(1400, now + 0.22);
    filter.Q.setValueAtTime(5.5, now);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now);
    noise.stop(now + 0.26);
  }

  public stopEngine() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.engineGain) this.engineGain.gain.setTargetAtTime(0, now, 0.05);
    if (this.screechGain) this.screechGain.gain.setTargetAtTime(0, now, 0.05);
    if (this.rumbleGain) this.rumbleGain.gain.setTargetAtTime(0, now, 0.05);
  }

  public playCountdownBeep(isFinal: boolean) {
    if (!this.ctx || this.isMuted) return;
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = isFinal ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isFinal ? 880 : 440, now);
    if (isFinal) {
      osc.frequency.exponentialRampToValueAtTime(1100, now + 0.3);
    }

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isFinal ? 0.45 : 0.2));

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + (isFinal ? 0.5 : 0.25));
  }

  public playLapChime() {
    if (!this.ctx || this.isMuted) return;
    this.init();
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 arpeggio

    notes.forEach((freq, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);

      gain.gain.setValueAtTime(0.18, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.4);
    });
  }

  public playWallImpact(intensity: number = 1.0) {
    if (!this.ctx || this.isMuted) return;
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.15);

    const vol = Math.min(0.28, 0.08 + intensity * 0.16);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.22);
  }

  public playClick() {
    if (!this.ctx || this.isMuted) return;
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  public playThunder() {
    if (!this.ctx || this.isMuted) return;
    this.init();
    const now = this.ctx.currentTime;
    if (!this.noiseBuffer) return;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, now);
    filter.frequency.exponentialRampToValueAtTime(55, now + 1.4);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.005, now + 1.5);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(now);
    noise.stop(now + 1.6);
  }

  public playBiomeSwitch() {
    if (!this.ctx || this.isMuted) return;
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.stopEngine();
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }
}

export const sound = new SoundEngine();
