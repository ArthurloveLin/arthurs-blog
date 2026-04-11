// NOTE: this pen uses a Club GreenSock plugin that must be paid for to use on your own site :(
gsap.config({ trialWarn: false });

// CONSTANTS
const board = document.querySelector("#board");
const trash = document.querySelector("#trash");
const numOfStickies = 102;
const stickyColors = ["#a9ef58", "#fbee9d", "#f45891", "#34add1", "#c97fe5"];

function createSticky(color, textvalue = "", x = undefined, y = undefined) {
  const sticky = document.createElement("div");
  sticky.classList.add("stickynote");
  if (color && x && y) {
    sticky.classList.add("used");
  }
  sticky.style.backgroundColor = color;

  const text = document.createElement("textarea");
  text.type = "text";
  text.placeholder = "Drag Me";
  if (color && x && y && !textvalue) {
    text.placeholder = "Write On Me";
  }
  text.value = textvalue;
  text.maxLength = 100;
  text.classList.add("stickynote-text");

  sticky.appendChild(text);
  if (x && y) {
    sticky.style.left = `${x}px`;
    sticky.style.top = `${y}px`;
  }

  board.appendChild(sticky);
}

// Make draggable sticky notes + animations with inertia
function createStickies() {
  // Puts stickies on DOM
  for (let i = 0; i < numOfStickies; i++) {
    createSticky(stickyColors[i % 5]);
  }

  // Draggable functionality
  const draggables = Draggable.create(".stickynote", {
    type: "x,y",
    onDragStart: function () {
      InertiaPlugin.track(this.target, "x");
      grabNoteAnimation(this.target);
      const inputField = this.target.querySelector(".stickynote-text");
      inputField.placeholder = "Stick Me";
    },
    onDrag: function () {
      let dx = InertiaPlugin.getVelocity(this.target, "x");
      gsap.to(this.target, {
        rotation: dx * -0.003,
        duration: 0.5,
        ease: "elastic.out(1.8, 0.6)",
        onComplete: () => {
          gsap.to(this.target, {
            // rotation: 0,
            duration: 0.5,
            ease: "elastic.out(1.8, 0.6)"
          });
        }
      });
      if (isOverlapping(trash, this.target)) {
        this.target.style.border = "solid 4px #d90429";
        this.target.style.borderRadius = "8px";
      } else {
        this.target.style.border = "";
        this.target.style.borderRadius = "";
      }
    },
    onDragEnd: function () {
      releaseNoteAnimation(this.target);
      const inputField = this.target.querySelector(".stickynote-text");
      inputField.placeholder = "Write On Me";
      if (isOverlapping(trash, this.target)) {
        gsap.to(this.target, {
          scale: 0,
          ease: "elastic.in(1, 0.8)",
          duration: 0.5,
          onComplete: () => {
            this.target.parentNode.removeChild(this.target);
            this.target.classList.remove("used");
            saveBoardState();
          }
        });
      } else {
        this.target.classList.add("used");
        saveBoardState();
      }
    },
    dragClickables: false
  });

  // Fixes weirdness of typing on text box and dragging
  document.querySelectorAll(".stickynote-text").forEach((textField) => {
    textField.addEventListener("focus", () => {
      draggables.forEach((instance) => {
        if (instance.target.contains(textField)) {
          instance.disable();
        }
      });
    });

    textField.addEventListener("blur", () => {
      draggables.forEach((instance) => {
        if (instance.target.contains(textField)) {
          instance.enable();
        }
      });
      saveBoardState();
    });
  });

  // Dynamically change height of textarea
  document.querySelectorAll("textarea").forEach((textarea) => {
    function setHeight() {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
    setHeight();
    textarea.addEventListener("input", setHeight);
    textarea.addEventListener("change", setHeight);
  });
}
restoreBoardState(); // restores the board state from previous sessions
createStickies(); // initial call

// Rotates backward on X axis and changes scale to appear like it is being ripped up
function grabNoteAnimation(target) {
  const timeline = gsap.timeline();
  timeline
    .to(target, {
      rotateX: 30,
      boxShadow:
        "-1px 14px 40px -4px rgba(0, 0, 0, 0.12), inset 0 14px 20px -12px rgba(0, 0, 0, 0.3)",
      duration: 0.3
    })
    .to(
      target,
      {
        rotation: 0,
        rotateX: 5,
        scale: 1.1,
        boxShadow:
          "-1px 14px 40px -4px rgba(0, 0, 0, 0.12), inset 0 24px 30px -12px rgba(0, 0, 0, 0.3)",
        ease: "elastic.out(0.8, 0.5)"
      },
      0.15
    );
  timeline.play();
}

// Does the reverse of the previous function with a few different modifications to stick back down
function releaseNoteAnimation(target) {
  const timeline = gsap.timeline();
  timeline
    .to(target, {
      rotateX: 30,
      boxShadow:
        "-1px 10px 5px -4px rgba(0, 0, 0, 0.2), inset 0 24px 30px -12px rgba(0, 0, 0, 0.3)",
      duration: 0.3
    })
    .to(
      target,
      {
        scale: 1
      },
      0
    )
    .to(
      target,
      {
        rotateX: 5,
        boxShadow:
          "-1px 10px 5px -4px rgba(0, 0, 0, 0.2), inset 0 24px 30px -12px rgba(0, 0, 0, 0.3)",
        ease: "elastic.out(0.8, 0.5)"
      },
      0.2
    );
  timeline.play();
}

// Checks to see if stickies overlap with trash but generalized for any element
function isOverlapping(element1, element2) {
  const rect1 = element1.getBoundingClientRect();
  const rect2 = element2.getBoundingClientRect();

  return !(
    (
      rect1.right < rect2.left || // rect1 is to the left of rect2
      rect1.left > rect2.right || // rect1 is to the right of rect2
      rect1.bottom < rect2.top || // rect1 is above rect2
      rect1.top > rect2.bottom
    ) // rect1 is below rect2
  );
}

// Resets board
function reset() {
  const cards = Array.from(document.querySelectorAll(".stickynote"));
  for (let i = 0; i < cards.length; i++) {
    cards[i].classList.remove("used");
    board.removeChild(cards[i]);
  }
  createStickies();
  saveBoardState();
}

// Trash hover state
trash.addEventListener("mouseenter", () => {
  gsap.to("#trash > svg", {
    scale: 0.8,
    y: "-=10"
  });
  gsap.to("#reset", {
    opacity: 1
  });
});

// Trash non-hover state
trash.addEventListener("mouseleave", () => {
  gsap.to("#trash > svg", {
    scale: 1,
    y: "+=10"
  });
  gsap.to("#reset", {
    opacity: 0
  });
});

// Reset board when trash is clicked
trash.addEventListener("click", reset);

// Saves properties of stickies to local storage when they are changed so they persist on refresh/revisit
function saveBoardState() {
  const stickies = document.querySelectorAll(".used");
  const stickiesData = Array.from(stickies).map((sticky, index) => {
    const rect = sticky.getBoundingClientRect();
    const stickyText = sticky.querySelector(".stickynote-text");
    return {
      id: index,
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
      text: stickyText ? stickyText.value : "",
      color: sticky.style.backgroundColor
    };
  });
  localStorage.setItem("stickiesData", JSON.stringify(stickiesData));
  const stickiesJson = localStorage.getItem("stickiesData");
  console.log("board state saved");
}

// If user has previously visited this pen their old stickies are still here :)
function restoreBoardState() {
  const stickiesJson = localStorage.getItem("stickiesData");
  if (stickiesJson) {
    const stickiesData = JSON.parse(stickiesJson);
    for (let i = 0; i < stickiesData.length; i++) {
      createSticky(
        stickiesData[i].color,
        stickiesData[i].text,
        stickiesData[i].x,
        stickiesData[i].y
      );
    }
    console.log("board state restored");
  }
}
