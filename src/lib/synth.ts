class SynthController {
  private ctx: AudioContext | null = null;

  private initCtx() {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public playSonarLock() {
    try {
      this.initCtx();
      if (!this.ctx) return;

      const t = this.ctx.currentTime;
      // Double click ping effect
      this.ping(t, 800, 0.15);
      this.ping(t + 0.12, 1100, 0.2);
    } catch (e) {
      console.warn("Synth playback blocked:", e);
    }
  }

  public playHorizonChirp(isRising: boolean) {
    try {
      this.initCtx();
      if (!this.ctx) return;

      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      const duration = 0.45;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.03, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

      osc.type = 'triangle';
      if (isRising) {
        // Ascending chime
        osc.frequency.setValueAtTime(330, t);
        osc.frequency.exponentialRampToValueAtTime(660, t + duration);
      } else {
        // Descending chime
        osc.frequency.setValueAtTime(660, t);
        osc.frequency.exponentialRampToValueAtTime(330, t + duration);
      }

      osc.start(t);
      osc.stop(t + duration);
    } catch (e) {
      console.warn("Synth playback blocked:", e);
    }
  }

  private ping(time: number, freq: number, duration: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);
    
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.04, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(time);
    osc.stop(time + duration);
  }
}

export const synth = new SynthController();
