import { motion } from "framer-motion";

/** Scroll-reveal wrapper. Respects theme.animationLevel ("full" | "subtle" | "none"). */
export function Reveal({ as: As = "div", animationLevel = "full", delay = 0, className = "", children, ...rest }) {
  if (animationLevel === "none") {
    const Tag = As;
    return (
      <Tag className={className} {...rest}>
        {children}
      </Tag>
    );
  }
  const distance = animationLevel === "subtle" ? 12 : 32;
  const MotionTag = motion[As] || motion.div;
  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, y: distance }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: animationLevel === "subtle" ? 0.5 : 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
      {...rest}
    >
      {children}
    </MotionTag>
  );
}
