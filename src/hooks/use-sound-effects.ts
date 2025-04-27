
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const useSoundEffects = () => {
  const successSoundRef = useRef<HTMLAudioElement | null>(null);
  const errorSoundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const loadSounds = async () => {
      try {
        const { data: successData } = await supabase.storage
          .from('sounds')
          .download('sm64_camera_click.wav');
        
        const { data: errorData } = await supabase.storage
          .from('sounds')
          .download('sm64_camera_buzz.wav');

        if (successData && errorData) {
          const successUrl = URL.createObjectURL(successData);
          const errorUrl = URL.createObjectURL(errorData);
          
          successSoundRef.current = new Audio(successUrl);
          errorSoundRef.current = new Audio(errorUrl);
        }
      } catch (error) {
        console.error('Error loading sounds:', error);
      }
    };

    loadSounds();

    // Cleanup
    return () => {
      if (successSoundRef.current) {
        URL.revokeObjectURL(successSoundRef.current.src);
      }
      if (errorSoundRef.current) {
        URL.revokeObjectURL(errorSoundRef.current.src);
      }
    };
  }, []);

  const playSuccessSound = () => {
    if (successSoundRef.current) {
      successSoundRef.current.currentTime = 0;
      successSoundRef.current.play();
    }
  };

  const playErrorSound = () => {
    if (errorSoundRef.current) {
      errorSoundRef.current.currentTime = 0;
      errorSoundRef.current.play();
    }
  };

  return { playSuccessSound, playErrorSound };
};

export default useSoundEffects;
