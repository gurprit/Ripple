import { useRef, useEffect, useState } from 'react';
import Lottie from 'lottie-react';
import heartAnimation from '../assets/heart_like_animation_lottie.json';

interface HeartButtonProps {
  liked: boolean;
  onClick: () => void;
}

export default function HeartButton({ liked, onClick }: HeartButtonProps) {
  const lottieRef = useRef<any>(null);
  const [displayedLike, setDisplayedLike] = useState(liked);
  const [isAnimating, setIsAnimating] = useState(false);

  // Sync animation frame with external 'liked' prop on refresh or change
  useEffect(() => {
    if (!lottieRef.current || isAnimating) return;

    lottieRef.current.stop();
    lottieRef.current.goToAndStop(liked ? 75 : 0, true);
    setDisplayedLike(liked);
  }, [liked, isAnimating]);

  const handleClick = () => {
    if (!lottieRef.current || isAnimating) return;

    setIsAnimating(true);
    lottieRef.current.stop();

    if (displayedLike) {
      // Play reverse (unlike)
      lottieRef.current.playSegments([75, 0], true);
      setDisplayedLike(false);
    } else {
      // Play forward (like)
      lottieRef.current.playSegments([0, 75], true);
      setDisplayedLike(true);
    }

    // Unlock animation after it plays
    setTimeout(() => {
      setIsAnimating(false);
    }, 800); // adjust based on animation speed

    onClick(); // notify parent
  };

  return (
    <div
      onClick={handleClick}
      className="timeline__post__like_button"
    >
      <Lottie
        lottieRef={lottieRef}
        animationData={heartAnimation}
        loop={false}
        autoplay={false}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
