import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/lib/local/db';

/**
 * Scan feedback: the app's own click (accepted) and buzz (rejected) sounds, plus vibration
 * where the phone supports it. The sounds are downloaded once and kept on the phone, so
 * they also play offline.
 */
const SOUNDS = {
  success: 'sm64_camera_click.wav',
  error: 'sm64_camera_buzz.wav',
} as const;

type Sound = keyof typeof SOUNDS;

const players: Partial<Record<Sound, HTMLAudioElement>> = {};
let loading: Promise<void> | null = null;

const metaKey = (sound: Sound) => `sound:${SOUNDS[sound]}`;

async function loadSound(sound: Sound) {
  let data: Blob | null = null;
  try {
    const download = await supabase.storage.from('sounds').download(SOUNDS[sound]);
    data = download.data;
    if (data) await db.meta.put({ key: metaKey(sound), value: await data.arrayBuffer() });
  } catch {
    // Offline: use the copy kept on the phone
  }
  if (!data) {
    const kept = (await db.meta.get(metaKey(sound)))?.value;
    if (kept instanceof ArrayBuffer) data = new Blob([kept], { type: 'audio/wav' });
  }
  if (data) players[sound] = new Audio(URL.createObjectURL(data));
}

function loadSounds() {
  loading ??= Promise.all([loadSound('success'), loadSound('error')])
    .then(() => undefined)
    .catch((error) => console.error('Error loading sounds:', error));
  return loading;
}

const vibrate = (pattern: number | number[]) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not supported: sound only
  }
};

const play = (sound: Sound) => {
  const player = players[sound];
  if (!player) return;
  player.currentTime = 0;
  // A missing sound must never break scanning
  player.play().catch(() => undefined);
};

const useSoundEffects = () => {
  void loadSounds();

  const playSuccessSound = useCallback(() => {
    play('success');
    vibrate(40);
  }, []);

  const playErrorSound = useCallback(() => {
    play('error');
    vibrate([120, 60, 120]);
  }, []);

  return { playSuccessSound, playErrorSound };
};

export default useSoundEffects;
