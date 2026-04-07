(function () {
  var prompts = [
    "I need to build a Motor Insurance Quote/Rate/Bind flow. Product needs TPL + Own Damage + Personal Accident, plus No-Claims Discount cascading across all coverages. What is the correct configuration sequence in Product Factory and Studio?",
    "In a Deposit Account Origination workflow, where should I configure field validation (not custom code), and how do I set up async KYC with a callback wait state?",
    "I'm launching a BNPL product with a 0% promo rate for 6 months, then a standard variable rate, plus a merchant fee matrix. What can I configure myself in Product Factory vs. what requires a developer?",
    "Build a 'Green Home Improvement Loan' for UK homeowners. Max 50k. Floating rate tied to BoE base + 2%. If Energy Rating = 'A', drop rate by 0.5%. Show me exactly where to configure everything.",
    "I need to expand our Policy Administration solution by adding a new product line. Give me the recommended configuration sequence, minimum components to update, and a safe rollout plan."
  ];

  var people = [
    { initial: "A", name: "Amina", position: "Configuration Consultant", company: "Partner" },
    { initial: "M", name: "Mateo", position: "Technical Consultant", company: "US Credit Union" },
    { initial: "P", name: "Priya", position: "Product Manager (BNPL)", company: "Consumer Finance" },
    { initial: "M", name: "Mark", position: "Product Owner (Lending)", company: "UK Building Society" },
    { initial: "E", name: "Emily", position: "Policy Operations Manager", company: "Insurer" }
  ];

  var TYPING_SPEED = 28;
  var SWIPE_DURATION = 500;
  var FADE_DURATION = 300;
  var CONTENT_FADE = 300;
  var SHIMMER_DURATION = 3000; // submit shimmer hold time

  var cards = [];           // the 5 <li> elements
  var order = [0,1,2,3,4];  // indices into cards[], order[0] = front
  var promptIdx = 0;         // which prompt we're on (cycles 0-4)
  var typing = false;
  var cycleId = 0;               // increments each new cycle; old cycles check & bail

  // Interruption flags
  var skipToNext = false;      // "new chat" clicked — skip everything, go to next card
  var skipToSubmit = false;    // "submit" clicked — finish typing instantly, shimmer 3s
  var swipeDirection = 1;      // 1 = right, -1 = left
  var typeResolve = null;      // resolve fn for the current typeText promise
  var typingTimer = null;      // current setTimeout id for typing tick

  var contentEl, typedEl, cursorEl;
  var personEl, nameEl, positionEl, companyEl;
  var stackEl, newChatEl, sendBtnEl;

  function init() {
    stackEl = document.getElementById("dexStack");
    if (!stackEl) return;
    cards = Array.from(stackEl.querySelectorAll(".dex-card"));

    contentEl = document.getElementById("dexContent");
    typedEl   = document.getElementById("dexTyped");
    cursorEl  = document.getElementById("dexCursor");
    personEl  = document.getElementById("dexPerson");
    nameEl    = document.getElementById("dexName");
    positionEl = document.getElementById("dexPosition");
    companyEl = document.getElementById("dexCompany");

    // Interactive elements
    newChatEl = contentEl.querySelector(".dex-new-chat-btn");
    sendBtnEl = contentEl.querySelector(".dex-send-btn");

    newChatEl.addEventListener("click", function() {
      skipToNext = true;
      cancelAllTimers();
      startNewCycle();
    });

    sendBtnEl.addEventListener("click", function() {
      if (!typing) return;
      skipToSubmit = true;
      typedEl.textContent = prompts[promptIdx] || "";
      cursorEl.classList.add("dex-hidden");
      // Only cancel typing timer — let the current cycle continue into shimmer
      if (typingTimer) { clearTimeout(typingTimer); typingTimer = null; }
      if (typeResolve) { typeResolve(); typeResolve = null; }
    });

    // Drag-to-swipe on front card
    initDrag();

    applyDepths();
    showPerson(promptIdx);
    startNewCycle();
  }

  function applyDepths() {
    order.forEach(function(cardIdx, depth) {
      cards[cardIdx].setAttribute("data-depth", depth);
      cards[cardIdx].classList.remove("dex-swipe-out");
    });
  }

  /* Move the content div into whichever card is front */
  function moveContentToFront() {
    var frontCard = cards[order[0]];
    frontCard.appendChild(contentEl);
  }

  function fadeContentIn() {
    contentEl.classList.remove("dex-content-hidden");
    return sleep(CONTENT_FADE);
  }

  function fadeContentOut() {
    contentEl.classList.add("dex-content-hidden");
    return sleep(CONTENT_FADE);
  }

  function showPerson(idx) {
    var p = people[idx];
    nameEl.textContent = p.name;
    positionEl.textContent = p.position;
    companyEl.textContent = p.company;
    personEl.classList.remove("dex-fade-out-left", "dex-fade-out-right");
    personEl.style.animation = "none";
    personEl.offsetHeight;
    personEl.style.animation = "";
  }

  function hidePerson() {
    var cls = swipeDirection < 0 ? "dex-fade-out-left" : "dex-fade-out-right";
    personEl.classList.add(cls);
    return sleep(FADE_DURATION);
  }

  function typeText() {
    return new Promise(function(resolve) {
      typeResolve = resolve;
      var text = prompts[promptIdx] || "";
      var i = 0;
      typedEl.textContent = "";
      cursorEl.classList.remove("dex-hidden");

      function tick() {
        if (skipToNext || skipToSubmit) {
          // interrupted — resolve handled by click handler
          return;
        }
        if (i < text.length) {
          typedEl.textContent += text[i];
          i++;
          typingTimer = setTimeout(tick, TYPING_SPEED + (Math.random() * 16 - 8));
        } else {
          cursorEl.classList.add("dex-hidden");
          typeResolve = null;
          resolve();
        }
      }
      tick();
    });
  }

  var pendingTimers = []; // all active sleep/fade timers we can cancel

  function sleep(ms) {
    return new Promise(function(r) {
      var id = setTimeout(function() {
        pendingTimers = pendingTimers.filter(function(t) { return t.id !== id; });
        r();
      }, ms);
      pendingTimers.push({ id: id, resolve: r });
    });
  }

  function cancelAllTimers() {
    if (typingTimer) { clearTimeout(typingTimer); typingTimer = null; }
    if (typeResolve) { typeResolve(); typeResolve = null; }
    pendingTimers.forEach(function(t) {
      clearTimeout(t.id);
      t.resolve();
    });
    pendingTimers = [];
  }

  // ---- Drag-to-swipe ----
  var DRAG_THRESHOLD = 200; // px to trigger swipe
  var dragging = false;
  var dragStartX = 0;
  var dragStartY = 0;
  var dragCard = null;
  var dragDirection = 0; // -1 left, 1 right
  var transitioning = false;
  var cqiPx = 5.6; // 1cqi in px — updated on drag start

  // Depth config in cqi units (must match CSS)
  var depthMargins  = [0, 2.8, 5.7, 8.5, 11.4];
  var depthTY       = [0, 2.8, 5.7, 8.5, 11.4];
  var depthOpacity  = [1, 0.65, 0.35, 0, 0];

  function initDrag() {
    stackEl.addEventListener("pointerdown", onDragStart);
    stackEl.addEventListener("pointermove", onDragMove);
    stackEl.addEventListener("pointerup", onDragEnd);
    stackEl.addEventListener("pointercancel", onDragEnd);
  }

  function onDragStart(e) {
    var front = cards[order[0]];
    if (!front.contains(e.target)) return;
    // Don't drag from interactive elements
    if (e.target.closest(".dex-send-btn, .dex-new-chat-btn")) return;
    // If a transition is running, cancel it and reset all cards to clean state
    if (transitioning) {
      transitioning = false;
      cycleId++;
      cancelAllTimers();
      resetCards(front);
      moveContentToFront();
      contentEl.classList.remove("dex-content-hidden");
      contentEl.style.opacity = "";
      // Keep person hidden — drag will control its visibility
      personEl.style.opacity = "0";
      personEl.style.transform = "";
      personEl.style.transition = "none";
    }
    dragging = true;
    dragCard = front;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragDirection = 0;
    dragCard.classList.add("dex-dragging");
    dragCard.setPointerCapture(e.pointerId);
    // Compute cqi-to-px factor from container width
    var wrapperEl = stackEl.closest('.dex-wrapper');
    if (wrapperEl) cqiPx = wrapperEl.offsetWidth / 100;
  }

  function onDragMove(e) {
    if (!dragging || !dragCard) return;
    var dx = e.clientX - dragStartX;
    var dy = (e.clientY - dragStartY) * 0.3;
    var rotate = dx * 0.04;
    dragDirection = dx < 0 ? -1 : 1;
    dragCard.style.transform = "translate(" + dx + "px, " + dy + "px) rotate(" + rotate + "deg)";
    dragCard.style.opacity = Math.max(1 - Math.abs(dx) / DRAG_THRESHOLD, 0.2);

    // Progressive promotion of back cards — moves at 15% of swipe speed
    var thresholdPx = DRAG_THRESHOLD;
    var swipeProgress = Math.min(Math.abs(dx) / thresholdPx, 1);
    var cardProgress = Math.min(Math.abs(dx) * 0.15 / thresholdPx, 1);
    for (var d = 1; d < order.length; d++) {
      var card = cards[order[d]];
      var fromM  = depthMargins[d] * cqiPx;
      var toM    = depthMargins[d - 1] * cqiPx;
      var fromTY = depthTY[d] * cqiPx;
      var toTY   = depthTY[d - 1] * cqiPx;
      var fromOp = depthOpacity[d];
      var toOp   = depthOpacity[d - 1];

      var m  = fromM  + (toM  - fromM)  * cardProgress;
      var ty = fromTY + (toTY - fromTY) * cardProgress;
      var op = fromOp + (toOp - fromOp) * cardProgress;

      card.style.transition = "none";
      card.style.marginLeft  = m + "px";
      card.style.marginRight = m + "px";
      card.style.transform   = "translateY(" + ty + "px)";
      card.style.opacity     = op;
    }

    // Fade content and person progressively (tied to swipe progress)
    contentEl.style.opacity = Math.max(1 - swipeProgress * 1.5, 0);
    personEl.style.opacity  = 1 - swipeProgress;
    // Move person in drag direction
    var personDx = dx * 0.3;
    personEl.style.transform = "translateX(" + personDx + "px)";
    personEl.style.transition = "none";
  }

  function onDragEnd(e) {
    if (!dragging || !dragCard) return;
    var dx = e.clientX - dragStartX;
    dragging = false;
    dragCard.classList.remove("dex-dragging");

    if (Math.abs(dx) > DRAG_THRESHOLD) {
      dragCard = null;
      swipeDirection = dragDirection;
      skipToNext = true;
      cancelAllTimers();
      completeDragSwipe();
    } else {
      // Snap back — front card
      dragCard.style.transform = "";
      dragCard.style.opacity = "";
      dragCard = null;

      // Restore transitions on back cards, then clear inline styles → animate back
      for (var d = 1; d < order.length; d++) {
        cards[order[d]].style.transition = "";
      }
      stackEl.offsetHeight; // reflow
      for (var d = 1; d < order.length; d++) {
        var card = cards[order[d]];
        card.style.marginLeft  = "";
        card.style.marginRight = "";
        card.style.transform   = "";
        card.style.opacity     = "";
      }

      // Restore content and person
      contentEl.style.opacity = "";
      personEl.style.opacity  = "";
      personEl.style.transform = "";
      personEl.style.transition = "";
    }
  }

  async function completeDragSwipe() {
    transitioning = true;
    var myCycleId = ++cycleId;
    typing = false;

    function stale() { return myCycleId !== cycleId; }

    // Clean up UI state
    typedEl.classList.remove("dex-shimmer");
    sendBtnEl.classList.remove("dex-loading");
    cursorEl.classList.add("dex-hidden");

    // Fully hide content (already faded from drag)
    contentEl.style.opacity = "";
    contentEl.classList.add("dex-content-hidden");

    // Hide person (already faded from drag)
    personEl.style.opacity = "0";

    // Swipe front card out
    var frontIdx = order[0];
    var swipeClass = swipeDirection < 0 ? "dex-swipe-out-left" : "dex-swipe-out";
    cards[frontIdx].classList.add(swipeClass);

    // Rotate order: front goes to back
    order.push(order.shift());

    // Move content to new front card (hidden)
    typedEl.textContent = "";
    moveContentToFront();

    // Apply new depths while inline styles still hold interpolated position
    order.forEach(function(cardIdx, depth) {
      if (cardIdx !== frontIdx) {
        cards[cardIdx].setAttribute("data-depth", depth);
        cards[cardIdx].style.transition = ""; // restore CSS transitions
      }
    });

    // Reflow so browser registers: transitions active, inline styles hold current pos
    stackEl.offsetHeight;

    // Clear inline styles → cards animate from interpolated position to new depth
    order.forEach(function(cardIdx) {
      if (cardIdx !== frontIdx) {
        cards[cardIdx].style.marginLeft  = "";
        cards[cardIdx].style.marginRight = "";
        cards[cardIdx].style.transform   = "";
        cards[cardIdx].style.opacity     = "";
      }
    });

    // Wait for swipe + back card transitions
    await sleep(SWIPE_DURATION);
    if (stale()) { transitioning = false; return; }

    // Place swiped card at very back (hidden) without transition
    cards[frontIdx].classList.remove("dex-swipe-out", "dex-swipe-out-left");
    cards[frontIdx].style.transform  = "";
    cards[frontIdx].style.opacity    = "";
    cards[frontIdx].style.transition = "none";
    cards[frontIdx].setAttribute("data-depth", order.indexOf(frontIdx));
    cards[frontIdx].offsetHeight;
    cards[frontIdx].style.transition = "";

    // Reset direction for next cycle
    swipeDirection = 1;

    // Advance prompt
    promptIdx = (promptIdx + 1) % prompts.length;

    // Show new person and fade content in
    personEl.style.opacity = "";
    personEl.style.transform = "";
    personEl.style.transition = "";
    showPerson(promptIdx);
    await fadeContentIn();
    if (stale()) { transitioning = false; return; }

    transitioning = false;
    skipToNext = false;
    typing = false;

    await sleep(300);
    if (stale()) return;

    runCycle(myCycleId);
  }

  async function doTransition(stale) {
    // fade out content + person
    await Promise.all([fadeContentOut(), hidePerson()]);
    if (stale()) return;

    // swipe front card AND reorder remaining cards at the same time
    var frontIdx = order[0];
    var swipeClass = swipeDirection < 0 ? "dex-swipe-out-left" : "dex-swipe-out";
    // Don't clear inline drag styles — the CSS class uses !important and
    // its own transition, so it animates smoothly from the current position
    cards[frontIdx].classList.add(swipeClass);

    // rotate order: front goes to back
    order.push(order.shift());

    // move content to the new front card (hidden) before applying depths
    typedEl.textContent = "";
    moveContentToFront();

    // apply new depths — remaining cards smoothly transition into new positions
    order.forEach(function(cardIdx, depth) {
      if (cardIdx !== frontIdx) {
        cards[cardIdx].setAttribute("data-depth", depth);
      }
    });

    // wait for swipe to finish
    await sleep(SWIPE_DURATION);
    if (stale()) return;

    // place the swiped card at the very back (hidden) without transition
    cards[frontIdx].classList.remove("dex-swipe-out");
    cards[frontIdx].classList.remove("dex-swipe-out-left");
    cards[frontIdx].style.transform = "";
    cards[frontIdx].style.opacity = "";
    cards[frontIdx].style.transition = "none";
    cards[frontIdx].setAttribute("data-depth", order.length - 1);
    cards[frontIdx].offsetHeight;
    cards[frontIdx].style.transition = "";

    // reset swipe direction for next cycle
    swipeDirection = 1;

    // advance prompt (loop)
    promptIdx = (promptIdx + 1) % prompts.length;

    // fade content in + show new person
    showPerson(promptIdx);
    await fadeContentIn();
  }

  function resetCards(skipCard) {
    // Force every card back to its correct depth instantly
    // skipCard = a card we should leave alone (e.g. mid-drag front card)
    cards.forEach(function(card) {
      if (card === skipCard) return;
      card.classList.remove("dex-swipe-out", "dex-swipe-out-left", "dex-dragging");
      card.style.transform = "";
      card.style.opacity = "";
      card.style.transition = "none";
    });
    order.forEach(function(cardIdx, depth) {
      if (cards[cardIdx] === skipCard) return;
      cards[cardIdx].setAttribute("data-depth", depth);
    });
    // Force reflow then restore transitions
    stackEl.offsetHeight;
    cards.forEach(function(card) {
      if (card === skipCard) return;
      card.style.transition = "";
    });
  }

  function startNewCycle() {
    cycleId++;
    typing = false;
    // Clean up visual state
    typedEl.classList.remove("dex-shimmer");
    sendBtnEl.classList.remove("dex-loading");
    cursorEl.classList.add("dex-hidden");
    contentEl.classList.remove("dex-content-hidden");
    // Keep the front card untouched (may be mid-drag)
    var frontCard = skipToNext ? cards[order[0]] : null;
    resetCards(frontCard);
    moveContentToFront();
    showPerson(promptIdx);
    runCycle(cycleId);
  }

  async function runCycle(myCycleId) {
    if (typing) return;
    typing = true;

    function stale() { return myCycleId !== cycleId; }

    // If skipToNext was set between cycles, go straight to transition
    if (skipToNext) {
      await doTransition(stale);
      if (stale()) return;
      typing = false;
      skipToNext = false;
      await sleep(300);
      if (stale()) return;
      typing = false;
      runCycle(myCycleId);
      return;
    }

    skipToNext = false;
    skipToSubmit = false;

    // type the prompt on the front card
    cursorEl.classList.remove("dex-hidden");
    await typeText();
    if (stale()) return;

    // Check if "new chat" was clicked — skip everything, just transition
    if (skipToNext) {
      cursorEl.classList.add("dex-hidden");
      await doTransition(stale);
      if (stale()) return;
      typing = false;
      skipToNext = false;
      await sleep(300);
      if (stale()) return;
      typing = false;
      runCycle(myCycleId);
      return;
    }

    // If "submit" was clicked, text is already filled — shimmer sweep then transition
    if (skipToSubmit) {
      sendBtnEl.classList.add("dex-loading");
      typedEl.classList.add("dex-shimmer");
      await sleep(2000);
      if (stale()) return;
      typedEl.classList.remove("dex-shimmer");
      sendBtnEl.classList.remove("dex-loading");
      await doTransition(stale);
      if (stale()) return;
      typing = false;
      skipToSubmit = false;
      await sleep(300);
      if (stale()) return;
      typing = false;
      runCycle(myCycleId);
      return;
    }

    // Normal flow: shimmer "thinking" effect — single sweep then move on
    typedEl.classList.add("dex-shimmer");
    await sleep(2000);
    if (stale()) return;
    typedEl.classList.remove("dex-shimmer");

    // transition to next card
    await doTransition(stale);
    if (stale()) return;

    typing = false;
    await sleep(300);
    if (stale()) return;
    typing = false;
    runCycle(myCycleId);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
