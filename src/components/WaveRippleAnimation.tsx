import Lottie from 'lottie-react';
import waveRippleAnimation from '../assets/wave_ripple_animation_lottie.json';

export default function WaveRipple() {
  return (
      <div className='wave-ripple-animation'>
        <Lottie
          animationData={waveRippleAnimation}
          loop
          autoplay
          rendererSettings={{
            progressiveLoad: true,
            preserveAspectRatio: 'xMidYMid meet',
          }}
        />
      </div>
  );
}
