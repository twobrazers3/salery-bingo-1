type BallReference = string | { letter?: string; number?: number | string; call?: string };

const AUTHENTIC_SOUND_FILES = new Set([
  'b-1', 'b-2', 'b-3', 'b-4', 'b-5', 'b-6', 'b-7', 'b-8', 'b-9', 'b-10',
  'b-11', 'b-12', 'b-13', 'b-14', 'b-15',
  'g-46', 'g-47', 'g-48', 'g-49', 'g-50', 'g-51', 'g-52',
  'bingo'
]);

const AMHARIC_LETTERS: Record<string, string> = {
  B: 'ቢ',
  I: 'አይ',
  N: 'ኤን',
  G: 'ጂ',
  O: 'ኦ'
};

const AMHARIC_NUMBERS: Record<number, string> = {
  1: 'አንድ', 2: 'ሁለት', 3: 'ሦስት', 4: 'አራት', 5: 'አምስት',
  6: 'ስድስት', 7: 'ሰባት', 8: 'ስምንት', 9: 'ዘጠኝ', 10: 'አስር',
  11: 'አስራ አንድ', 12: 'አስራ ሁለት', 13: 'አስራ ሦስት', 14: 'አስራ አራት', 15: 'አስራ አምስት',
  16: 'አስራ ስድስት', 17: 'አስራ ሰባት', 18: 'አስራ ስምንት', 19: 'አስራ ዘጠኝ', 20: 'ሀያ',
  21: 'ሀያ አንድ', 22: 'ሀያ ሁለት', 23: 'ሀያ ሦስት', 24: 'ሀያ አራት', 25: 'ሀያ አምስት',
  26: 'ሀያ ስድስት', 27: 'ሀያ ሰባት', 28: 'ሀያ ስምንት', 29: 'ሀያ ዘጠኝ', 30: 'ሰላሳ',
  31: 'ሰላሳ አንድ', 32: 'ሰላሳ ሁለት', 33: 'ሰላሳ ሦስት', 34: 'ሰላሳ አራት', 35: 'ሰላሳ አምስት',
  36: 'ሰላሳ ስድስት', 37: 'ሰላሳ ሰባት', 38: 'ሰላሳ ስምንት', 39: 'ሰላሳ ዘጠኝ', 40: 'አርባ',
  41: 'አርባ አንድ', 42: 'አርባ ሁለት', 43: 'አርባ ሦስት', 44: 'አርባ አራት', 45: 'አርባ አምስት',
  46: 'አርባ ስድስት', 47: 'አርባ ሰባት', 48: 'አርባ ስምንት', 49: 'አርባ ዘጠኝ', 50: 'ሃምሳ',
  51: 'ሃምሳ አንድ', 52: 'ሃምሳ ሁለት', 53: 'ሃምሳ ሦስት', 54: 'ሃምሳ አራት', 55: 'ሃምሳ አምስት',
  56: 'ሃምሳ ስድስት', 57: 'ሃምሳ ሰባት', 58: 'ሃምሳ ስምንት', 59: 'ሃምሳ ዘጠኝ', 60: 'ስልሳ',
  61: 'ስልሳ አንድ', 62: 'ስልሳ ሁለት', 63: 'ስልሳ ሦስት', 64: 'ስልሳ አራት', 65: 'ስልሳ አምስት',
  66: 'ስልሳ ስድስት', 67: 'ስልሳ ሰባት', 68: 'ስልሳ ስምንት', 69: 'ስልሳ ዘጠኝ', 70: 'ሰባ',
  71: 'ሰባ አንድ', 72: 'ሰባ ሁለት', 73: 'ሰባ ሦስት', 74: 'ሰባ አራት', 75: 'ሰባ አምስት'
};

class SoundEffects {
  public soundEnabled = true;
  public voiceEnabled = true;
  private audioCache = new Map<string, HTMLAudioElement>();
  private audioCtx: AudioContext | null = null;
  private currentAudio: HTMLAudioElement | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      // Preload the authentic original Amharic audio files
      AUTHENTIC_SOUND_FILES.forEach((file) => {
        try {
          const audio = new Audio(`/bingo sound/${file}.mp3`);
          audio.preload = 'auto';
          this.audioCache.set(file, audio);
        } catch {}
      });

      // Unlock audio on first user interaction
      const unlock = () => {
        this.unlockAudio();
        window.removeEventListener('click', unlock);
        window.removeEventListener('touchstart', unlock);
      };
      window.addEventListener('click', unlock, { once: true });
      window.addEventListener('touchstart', unlock, { once: true });
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  public unlockAudio() {
    const ctx = this.getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  private resolveCallFileName(input: BallReference): string | null {
    if (typeof input === 'string') {
      if (/^bingo$/i.test(input.trim())) {
        return 'bingo';
      }
      const match = input.trim().match(/^([a-zA-Z])\s*[-_\s]?\s*(\d{1,2})$/);
      if (match) {
        return `${match[1].toLowerCase()}-${match[2]}`;
      }
      return null;
    }

    if (!input || typeof input !== 'object') return null;

    if (input.call) {
      const match = input.call.trim().match(/^([a-zA-Z])\s*[-_\s]?\s*(\d{1,2})$/);
      if (match) {
        return `${match[1].toLowerCase()}-${match[2]}`;
      }
    }

    if (input.letter && input.number !== undefined) {
      return `${String(input.letter).trim().toLowerCase()}-${String(input.number).trim()}`;
    }

    return null;
  }

  public stopAllAudio() {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch {}
      this.currentAudio = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  }

  public playTone(freq = 523.25, duration = 0.15, gainVal = 0.15) {
    if (!this.soundEnabled || typeof window === 'undefined') return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {}
  }

  public playDaub() {
    if (!this.soundEnabled) return;
    this.playTone(880, 0.1, 0.18);
  }

  public playBeep(_success = true) {}

  private lastBingoPlayedTimestamp = 0;

  public playWinFanfare() {
    this.playBingo();
  }

  public playBingo() {
    const now = Date.now();
    // Strictly prevent repeated re-triggering of bingo sound within 7 seconds of winning
    if (now - this.lastBingoPlayedTimestamp < 7000) {
      return;
    }
    this.lastBingoPlayedTimestamp = now;

    this.stopAllAudio();
    const audio = this.audioCache.get('bingo');
    if (audio) {
      audio.currentTime = 0;
      audio.volume = 1;
      this.currentAudio = audio;
      audio.play().catch(() => {});
    }
  }

  private getAmharicVoice(): SpeechSynthesisVoice | null {
    if (typeof window === 'undefined' || !window.speechSynthesis) return null;
    try {
      const voices = window.speechSynthesis.getVoices();
      const amVoice = voices.find(v => v.lang.toLowerCase().startsWith('am'));
      if (amVoice) return amVoice;
    } catch {}
    return null;
  }

  private speakAmharic(text: string) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const voice = this.getAmharicVoice();
      if (!voice) return; // Completely avoid speaking if no native Amharic voice is installed (removes English fallback!)

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.lang = 'am-ET';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch {}
  }

  public playCalledNumber(input: BallReference) {
    if (!this.soundEnabled && !this.voiceEnabled) return;

    const fileName = this.resolveCallFileName(input);
    if (!fileName) return;

    this.stopAllAudio();

    // Play a gentle ball drop ding
    this.playTone(523.25, 0.12, 0.15);

    // Play ONLY authentic MP3 voice files if it exists
    if (AUTHENTIC_SOUND_FILES.has(fileName)) {
      const audio = this.audioCache.get(fileName);
      if (audio) {
        audio.currentTime = 0;
        audio.volume = 1;
        this.currentAudio = audio;
        audio.play().catch(() => {});
      }
    } else {
      // Speak in native Amharic TTS if available in browser, else stay silent (completely blocks English TTS fallback!)
      try {
        let letter = '';
        let numVal = 0;

        if (typeof input === 'string') {
          const match = input.trim().match(/^([a-zA-Z])\s*[-_\s]?\s*(\d{1,2})$/);
          if (match) {
            letter = match[1].toUpperCase();
            numVal = Number(match[2]);
          }
        } else if (input && typeof input === 'object') {
          letter = String(input.letter || '').toUpperCase();
          numVal = Number(input.number);
        }

        if (letter && numVal && AMHARIC_LETTERS[letter] && AMHARIC_NUMBERS[numVal]) {
          const amText = `${AMHARIC_LETTERS[letter]} ${AMHARIC_NUMBERS[numVal]}`;
          this.speakAmharic(amText);
        }
      } catch {}
    }
  }

  speakBall(letter: string, num: number | string) {
    this.playCalledNumber({ letter, number: num });
  }

  startBGM() {}
  stopBGM() {}
}

export const sounds = new SoundEffects();
