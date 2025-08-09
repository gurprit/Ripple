import Lottie from 'lottie-react';
import rainbowRipple from '../assets/rainbow_ripple_animation_lottie.json';

export default function RainbowRipple() {
  return (
      <div className='rainbow-ripple-animation'>
        <Lottie
          animationData={rainbowRipple}
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
