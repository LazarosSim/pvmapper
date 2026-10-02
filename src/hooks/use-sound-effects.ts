import { useCallback, useRef } from 'react';

/**
 * Scan feedback: a short beep and buzz made by the phone itself (nothing to download,
 * so they also work offline), plus vibration where the phone supports it.
 */
type Tone = { frequency: number; duration: number; type: OscillatorType };

const SUCCESS: Tone[] = [{ frequency: 1760, duration: 0.08, type: 'sine' }];
const ERROR: Tone[] = [
  { frequency: 220, duration: 0.15, type: 'square' },
  { frequency: 180, duration: 0.2, type: 'square' },
];

const vibrate = (pattern: number | number[]) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not supported: sound only
  }
};

const useSoundEffects = () => {
  const contextRef = useRef<AudioContext | null>(null);

  const play = useCallback((tones: Tone[], volume: number) => {
    try {
      const AudioContextClass =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const context = (contextRef.current ??= new AudioContextClass());
      // Browsers start audio suspended until the user has interacted with the page
      if (context.state === 'suspended') context.resume().catch(() => undefined);

      let start = context.currentTime;
      for (const tone of tones) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = tone.type;
        oscillator.frequency.value = tone.frequency;
        gain.gain.setValueAtTime(volume, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + tone.duration);
        start += tone.duration + 0.03;
      }
    } catch {
      // A missing beep must never break scanning
    }
  }, []);

  const playSuccessSound = useCallback(() => {
    play(SUCCESS, 0.3);
    vibrate(40);
  }, [play]);

  const playErrorSound = useCallback(() => {
    play(ERROR, 0.25);
    vibrate([120, 60, 120]);
  }, [play]);

  return { playSuccessSound, playErrorSound };
};

export default useSoundEffects;
