export const fadeSlide = {
    initial: { opacity: 0, y: -12 },
    animate: { opacity: 1, y: 0 },
    exit:    { opacity: 0, y: 6 },
    transition: { duration: 0.75, ease: 'easeOut' }
  }
  
  export const scaleFade = {
    initial: { opacity: 0, scale: 0.96 },
    animate: { opacity: 1, scale: 1 },
    exit:    { opacity: 0, scale: 0.98 },
    transition: { duration: 0.22, ease: 'easeOut' }
  }
  