import Lottie from 'lottie-react';
import waterAnim from '../assets/water_animation_lottie.json';

export default function RippleButton() {
  return (
      <div className='ripple-animation'>
        <Lottie
          animationData={waterAnim}
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
