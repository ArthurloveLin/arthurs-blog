const throttle = (callback, limit) => {
  let waiting = false;
  return function () {
    if (!waiting) {
      callback.apply(this, arguments);
      waiting = true;
      setTimeout(() => {
        waiting = false;
      }, limit);
    }
  };
};

const debounce = (func, wait, immediate) => {
  let timeout;
  return function () {
    const context = this;
    const args = arguments;
    const later = function () {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
};

const SLIDES = [
  {
    name: "Fjord",
    color: "#6B5B50",
    image:
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=600&q=80"
  },
  {
    name: "Aether",
    color: "#B8B5A4",
    image:
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&q=80"
  },
  {
    name: "Onyx",
    color: "#8BA8A8",
    image:
      "https://images.unsplash.com/photo-1588880331179-bc9b93a8cb5e?w=600&q=80"
  },
  {
    name: "Birch",
    color: "#B5A882",
    image:
      "https://images.unsplash.com/photo-1600585154363-67eb9e2e2099?w=600&q=80"
  }
];

const AUTOPLAY_DELAY = 4000;

class Slider {
  constructor() {
    this.current = 0;
    this.animating = false;
    this.total = SLIDES.length;
    this.el = document.querySelector(".slider");
    this.titleEl = document.querySelector(".slider__title");
    this.imagesEl = document.querySelector(".slider__images");
    this.slideEls = [];
    this.currentLine = null;
    this.cursorVisible = false;
    this.autoPlayId = null;
    this.reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    this.preload();
    this.setTitle(SLIDES[0].name);
    gsap.set(this.el, { backgroundColor: SLIDES[0].color });
    this.buildCarousel();
    this.buildCursor();
    this.bind();
    this.startAutoPlay();
  }

  preload() {
    SLIDES.forEach((s) => {
      new Image().src = s.image;
    });
  }

  mod(n) {
    return ((n % this.total) + this.total) % this.total;
  }

  buildCursor() {
    this.cursorEl = document.createElement("div");
    this.cursorEl.className = "slider__cursor";
    this.cursorEl.textContent = "+";
    this.cursorEl.setAttribute("aria-hidden", "true");
    this.el.appendChild(this.cursorEl);
    gsap.set(this.cursorEl, { xPercent: -50, yPercent: -50, opacity: 0 });
    this.cursorMoveX = gsap.quickTo(this.cursorEl, "x", {
      duration: 0.5,
      ease: "power3"
    });
    this.cursorMoveY = gsap.quickTo(this.cursorEl, "y", {
      duration: 0.5,
      ease: "power3"
    });
  }

  startAutoPlay() {
    this.stopAutoPlay();
    this.autoPlayId = setInterval(() => {
      if (!this.animating) this.go("next");
    }, AUTOPLAY_DELAY);
  }

  stopAutoPlay() {
    if (this.autoPlayId) {
      clearInterval(this.autoPlayId);
      this.autoPlayId = null;
    }
  }

  setTitle(text) {
    this.titleEl.innerHTML = "";
    const line = document.createElement("div");
    [...text].forEach((ch) => {
      const span = document.createElement("span");
      span.textContent = ch === " " ? "\u00A0" : ch;
      line.appendChild(span);
    });
    this.titleEl.appendChild(line);
    this.currentLine = line;
  }

  animateTitle(newText, direction) {
    const h = this.titleEl.offsetHeight;
    const dir = direction === "next" ? 1 : -1;
    const oldLine = this.currentLine;
    const oldChars = [...oldLine.querySelectorAll("span")];

    this.titleEl.style.height = h + "px";
    oldLine.style.cssText = "position:absolute;top:0;left:0;width:100%";

    const newLine = document.createElement("div");
    newLine.style.cssText = "position:absolute;top:0;left:0;width:100%";
    [...newText].forEach((ch) => {
      const span = document.createElement("span");
      span.textContent = ch === " " ? "\u00A0" : ch;
      newLine.appendChild(span);
    });
    this.titleEl.appendChild(newLine);

    const newChars = [...newLine.querySelectorAll("span")];
    gsap.set(newChars, { y: h * dir });

    const duration = this.reducedMotion ? 0.01 : 1;
    const stagger = this.reducedMotion ? 0 : 0.04;

    const tl = gsap.timeline({
      onComplete: () => {
        oldLine.remove();
        newLine.style.cssText = "";
        gsap.set(newChars, { clearProps: "all" });
        this.titleEl.style.height = "";
        this.currentLine = newLine;
      }
    });

    tl.to(
      oldChars,
      {
        y: -h * dir,
        stagger: stagger,
        duration: duration,
        ease: "expo.inOut"
      },
      0
    );

    tl.to(
      newChars,
      {
        y: 0,
        stagger: stagger,
        duration: duration,
        ease: "expo.inOut"
      },
      0
    );

    return tl;
  }

  makeSlide(idx) {
    const div = document.createElement("div");
    div.className = "slider__slide";
    const img = document.createElement("img");
    img.src = SLIDES[idx].image;
    img.alt = SLIDES[idx].name;
    img.width = 600;
    img.height = 420;
    div.appendChild(img);
    return div;
  }

  getSlideProps(step) {
    const h = this.imagesEl.offsetHeight;
    const absStep = Math.abs(step);
    const positions = [
      { x: -0.35, y: -0.95, rot: -30, s: 1.35, b: 16, o: 0 },
      { x: -0.18, y: -0.5, rot: -15, s: 1.15, b: 8, o: 0.55 },
      { x: 0, y: 0, rot: 0, s: 1, b: 0, o: 1 },
      { x: -0.06, y: 0.5, rot: 15, s: 0.75, b: 6, o: 0.55 },
      { x: -0.12, y: 0.95, rot: 30, s: 0.55, b: 14, o: 0 }
    ];
    const idx = Math.max(0, Math.min(4, step + 2));
    const p = positions[idx];

    return {
      x: p.x * h,
      y: p.y * h,
      rotation: p.rot,
      scale: p.s,
      blur: p.b,
      opacity: p.o,
      zIndex: absStep === 0 ? 3 : absStep === 1 ? 2 : 1
    };
  }

  positionSlide(slide, step) {
    const props = this.getSlideProps(step);
    gsap.set(slide, {
      xPercent: -50,
      yPercent: -50,
      x: props.x,
      y: props.y,
      rotation: props.rotation,
      scale: props.scale,
      opacity: props.opacity,
      filter: "blur(" + props.blur + "px)",
      zIndex: props.zIndex
    });
  }

  buildCarousel() {
    if (!this.imagesEl || this.imagesEl.offsetHeight === 0) return;
    this.imagesEl.innerHTML = "";
    this.slideEls = [];

    for (let step = -1; step <= 1; step++) {
      const idx = this.mod(this.current + step);
      const slide = this.makeSlide(idx);
      this.imagesEl.appendChild(slide);
      this.positionSlide(slide, step);
      this.slideEls.push({ el: slide, step: step });
    }
  }

  animateCarousel(direction) {
    if (!this.imagesEl || this.imagesEl.offsetHeight === 0)
      return gsap.timeline();

    const shift = direction === "next" ? -1 : 1;
    const enterStep = direction === "next" ? 2 : -2;
    const newIdx =
      direction === "next"
        ? this.mod(this.current + 2)
        : this.mod(this.current - 2);

    const newSlide = this.makeSlide(newIdx);
    this.imagesEl.appendChild(newSlide);
    this.positionSlide(newSlide, enterStep);
    this.slideEls.push({ el: newSlide, step: enterStep });

    this.slideEls.forEach((s) => {
      s.step += shift;
    });

    const duration = this.reducedMotion ? 0.01 : 1.2;

    const tl = gsap.timeline({
      onComplete: () => {
        this.slideEls = this.slideEls.filter((s) => {
          if (Math.abs(s.step) >= 2) {
            s.el.remove();
            return false;
          }
          return true;
        });
      }
    });

    this.slideEls.forEach((s) => {
      const props = this.getSlideProps(s.step);
      s.el.style.zIndex = props.zIndex;

      tl.to(
        s.el,
        {
          x: props.x,
          y: props.y,
          rotation: props.rotation,
          scale: props.scale,
          opacity: props.opacity,
          filter: "blur(" + props.blur + "px)",
          duration: duration,
          ease: "power3.inOut"
        },
        0
      );
    });

    return tl;
  }

  go(direction) {
    if (this.animating) return;
    this.animating = true;
    this.startAutoPlay();

    const nextIdx =
      direction === "next"
        ? this.mod(this.current + 1)
        : this.mod(this.current - 1);

    const master = gsap.timeline({
      onComplete: () => {
        this.current = nextIdx;
        this.animating = false;
      }
    });

    master.to(
      this.el,
      {
        backgroundColor: SLIDES[nextIdx].color,
        duration: this.reducedMotion ? 0.01 : 1.2,
        ease: "power2.inOut"
      },
      0
    );

    master.add(this.animateTitle(SLIDES[nextIdx].name, direction), 0);
    master.add(this.animateCarousel(direction), 0);
  }

  bind() {
    const onWheel = throttle((e) => {
      if (this.animating) return;
      this.go(e.deltaY > 0 ? "next" : "prev");
    }, 1800);
    window.addEventListener("wheel", onWheel, { passive: true });

    let touchStartY = 0;
    window.addEventListener(
      "touchstart",
      (e) => {
        touchStartY = e.touches[0].clientY;
      },
      { passive: true }
    );

    const onTouchEnd = throttle((e) => {
      if (this.animating) return;
      const diff = touchStartY - e.changedTouches[0].clientY;
      if (Math.abs(diff) < 40) return;
      this.go(diff > 0 ? "next" : "prev");
    }, 1800);
    window.addEventListener("touchend", onTouchEnd, { passive: true });

    window.addEventListener("keydown", (e) => {
      if (this.animating) return;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") this.go("next");
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") this.go("prev");
    });

    this.el.addEventListener(
      "mousemove",
      (e) => {
        if (!this.cursorVisible) {
          gsap.to(this.cursorEl, { opacity: 1, duration: 0.3 });
          this.cursorVisible = true;
        }
        this.cursorMoveX(e.clientX);
        this.cursorMoveY(e.clientY);
      },
      { passive: true }
    );

    this.el.addEventListener("mouseleave", () => {
      gsap.to(this.cursorEl, { opacity: 0, duration: 0.3 });
      this.cursorVisible = false;
    });

    const onResize = debounce(() => {
      if (!this.animating && this.imagesEl.offsetHeight > 0) {
        this.slideEls.forEach((s) => {
          this.positionSlide(s.el, s.step);
        });
      }
    }, 300);
    window.addEventListener("resize", onResize, { passive: true });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        this.animating = false;
        this.stopAutoPlay();
      } else {
        this.startAutoPlay();
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new Slider();
});
