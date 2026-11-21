'use client';
import { createContext, useContext, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const AccordionContext = createContext({
  activeValues: [],
  toggle: () => {},
  transition: { duration: 0.25, ease: 'easeInOut' },
});

const AccordionItemContext = createContext({
  value: '',
  isExpanded: false,
});

/**
 * Accordion component from Motion-Primitives (ibelick/motion-primitives)
 * Smooth collapsible panels animated via Motion.
 */
export function Accordion({
  children,
  className = '',
  transition = { duration: 0.25, ease: 'easeInOut' },
  expandedValue,
  onValueChange,
  defaultValue = null,
  multiple = true,
}) {
  const [internalValues, setInternalValues] = useState(() => {
    if (defaultValue === null || defaultValue === undefined) return [];
    return Array.isArray(defaultValue) ? defaultValue : [defaultValue];
  });

  const activeValues = expandedValue !== undefined
    ? (Array.isArray(expandedValue) ? expandedValue : [expandedValue])
    : internalValues;

  const toggle = (val) => {
    let next;
    if (multiple) {
      next = activeValues.includes(val)
        ? activeValues.filter((v) => v !== val)
        : [...activeValues, val];
    } else {
      next = activeValues.includes(val) ? [] : [val];
    }

    if (onValueChange) onValueChange(next);
    if (expandedValue === undefined) setInternalValues(next);
  };

  return (
    <AccordionContext.Provider value={{ activeValues, toggle, transition }}>
      <div className={className}>{children}</div>
    </AccordionContext.Provider>
  );
}

export function AccordionItem({
  value,
  children,
  className = '',
}) {
  const { activeValues } = useContext(AccordionContext);
  const isExpanded = activeValues.includes(value);

  return (
    <AccordionItemContext.Provider value={{ value, isExpanded }}>
      <div
        data-expanded={isExpanded ? 'true' : undefined}
        className={`group ${className}`}
      >
        {children}
      </div>
    </AccordionItemContext.Provider>
  );
}

export function AccordionTrigger({
  children,
  className = '',
  onClick,
}) {
  const { toggle } = useContext(AccordionContext);
  const { value, isExpanded } = useContext(AccordionItemContext);

  const handleClick = (e) => {
    onClick?.(e);
    toggle(value);
  };

  return (
    <button
      type="button"
      aria-expanded={isExpanded}
      onClick={handleClick}
      className={`group/trigger flex w-full cursor-pointer items-center justify-between transition-all ${className}`}
    >
      {typeof children === 'function' ? children({ isExpanded }) : children}
    </button>
  );
}

export function AccordionContent({
  children,
  className = '',
}) {
  const { transition } = useContext(AccordionContext);
  const { isExpanded } = useContext(AccordionItemContext);

  return (
    <AnimatePresence initial={false}>
      {isExpanded && (
        <motion.div
          key="accordion-content"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={transition}
          className="overflow-hidden"
        >
          <div className={className}>{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default Accordion;
