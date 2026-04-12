const lenis = new Lenis();
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((time) => {
  lenis.raf(time * 1000);
});
gsap.ticker.lagSmoothing(0);

gsap.registerPlugin(ScrollTrigger);

const reverseTrigger = gsap.utils.toArray(
  ".col-scroll__box:nth-child(odd) .col-scroll__list"
);

reverseTrigger.forEach((element) => {
  const elementHeight = element.offsetHeight;
  const viewportHeight = window.innerHeight;
  const extraSpace = viewportHeight * 0.2;
  const scrollDistance = elementHeight + viewportHeight + extraSpace;

  gsap.to(element, {
    yPercent: 100,
    scrollTrigger: {
      trigger: element,
      start: 0,
      end: `+=${scrollDistance}`,
      scrub: true,
      pin: true
      // markers: true
    }
  });
});
