'use client';
import { useRef } from 'react';
import { motion, useInView } from 'motion/react';

const defaultVariants = {
  hidden: { opacity: 0, y: 30, filter: 'blur(4px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
};

const defaultTransition = {
  duration: 0.35,
  ease: 'easeInOut',
};

/**
 * InView component from Motion-Primitives (ibelick/motion-primitives)
 * Triggers entrance and scroll animations as elements enter/exit the viewport.
 */
export function InView({
  children,
  variants = defaultVariants,
  transition = defaultTransition,
  viewOptions = {},
  as = 'div',
  className = '',
  ...props
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, {
    once: false,
    ...viewOptions,
  });

  const Component = typeof motion[as] === 'object' ? motion[as] : motion.create(as);

  return (
    <Component
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={variants}
      transition={transition}
      className={className}
      {...props}
    >
      {children}
    </Component>
  );
}

export default InView;
