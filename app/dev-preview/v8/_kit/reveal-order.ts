/** Shared entrance order for the site and docs. Layout position wins over DOM/observer callback order. */
export function revealInOrder(elements: HTMLElement[], className: string, delayProperty: string) {
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const pending = new Set(elements);
  const timers: ReturnType<typeof setTimeout>[] = [];
  let observer: IntersectionObserver | undefined;
  let lastStart = 0;
  const clear = (el: HTMLElement) => {
    el.classList.remove(className, `${className}--in`);
    el.style.removeProperty(delayProperty);
  };
  const finish = () => {
    observer?.disconnect();
    timers.forEach(clearTimeout);
    elements.forEach(clear);
    pending.clear();
  };
  if (motion.matches) return finish;
  elements.forEach((el) => el.classList.add(className));
  const show = (batch: HTMLElement[]) => {
    const ordered = batch.filter((el) => pending.has(el)).map((el) => ({ el, box: el.getBoundingClientRect() }))
      .sort((a, b) => a.box.top - b.box.top || a.box.left - b.box.left);
    const now = performance.now();
    // A large viewport gets a short sequence too, without giving later blocks identical capped delays.
    const step = Math.min(70, 560 / Math.max(1, ordered.length - 1));
    for (const { el, box } of ordered) {
      pending.delete(el);
      observer?.unobserve(el);
      // Restored scroll / anchor navigation: offscreen history must not consume the visible stagger.
      if (box.bottom <= 0 || !el.getClientRects().length) { clear(el); continue; }
      lastStart = Math.max(now, lastStart + step);
      const delay = Math.max(0, lastStart - now);
      el.style.setProperty(delayProperty, `${delay}ms`);
      el.classList.add(`${className}--in`);
      timers.push(setTimeout(() => clear(el), delay + 900));
    }
  };
  const frame = requestAnimationFrame(() => {
    observer = new IntersectionObserver((entries) => {
      show(entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target as HTMLElement));
    }, { rootMargin: "0px 0px -8% 0px" });
    show(elements.filter((el) => el.getBoundingClientRect().top < innerHeight * .92));
    pending.forEach((el) => observer!.observe(el));
  });
  const onMotion = () => { if (motion.matches) { cancelAnimationFrame(frame); finish(); } };
  motion.addEventListener("change", onMotion);
  return () => {
    cancelAnimationFrame(frame);
    motion.removeEventListener("change", onMotion);
    finish();
  };
}
