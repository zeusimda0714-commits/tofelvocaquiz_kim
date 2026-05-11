const data = window.VOCA_DATA || [];

const els = {
  source: document.querySelector("#sourceSelect"),
  day: document.querySelector("#daySelect"),
  mode: document.querySelector("#modeSelect"),
  card: document.querySelector("#card"),
  cardMeta: document.querySelector("#cardMeta"),
  word: document.querySelector("#wordText"),
  hint: document.querySelector("#hintText"),
  meaning: document.querySelector("#meaningText"),
  synonym: document.querySelector("#synonymText"),
  panel: document.querySelector("#quizPanel"),
  count: document.querySelector("#countText"),
  score: document.querySelector("#scoreText"),
  streak: document.querySelector("#streakText"),
  shuffle: document.querySelector("#shuffleBtn"),
  prev: document.querySelector("#prevBtn"),
  flip: document.querySelector("#flipBtn"),
  next: document.querySelector("#nextBtn"),
};

let deck = [];
let index = 0;
let score = 0;
let streak = 0;
let answered = false;
let matchRound = [];
let selectedMatch = null;
let matchedPairs = new Set();

const allSources = ["전체", ...new Set(data.map((item) => item.source))];

function fillSelects() {
  els.source.innerHTML = allSources.map((source) => `<option>${source}</option>`).join("");
  els.day.innerHTML = [
    "<option value=\"all\">전체</option>",
    ...Array.from({ length: 30 }, (_, i) => `<option value="${i + 1}">Day ${i + 1}</option>`),
  ].join("");
}

function shuffleDeck(items) {
  const copied = [...items];
  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }
  return copied;
}

function currentFilters() {
  return {
    source: els.source.value,
    day: els.day.value,
  };
}

function buildDeck(keepScore = false) {
  const filters = currentFilters();
  deck = data.filter((item) => {
    const sourceOk = filters.source === "전체" || item.source === filters.source;
    const dayOk = filters.day === "all" || item.day === Number(filters.day);
    return sourceOk && dayOk;
  });
  index = 0;
  answered = false;
  if (!keepScore) {
    score = 0;
    streak = 0;
  }
  render();
}

function currentCard() {
  return deck[index];
}

function render() {
  els.score.textContent = score;
  els.streak.textContent = streak;
  els.count.textContent = deck.length ? `${index + 1} / ${deck.length}` : "0 / 0";
  els.card.classList.remove("flipped");

  if (!deck.length) {
    els.cardMeta.textContent = "카드 없음";
    els.word.textContent = "선택한 범위에 카드가 없어요";
    els.hint.textContent = "다른 Day를 골라주세요";
    els.meaning.textContent = "";
    els.synonym.textContent = "";
    els.panel.innerHTML = "";
    return;
  }

  const item = currentCard();
  els.cardMeta.textContent = `${item.source} · Day ${item.day}`;
  els.word.textContent = item.word;
  els.hint.textContent = els.mode.value === "flash" ? "클릭하면 뜻을 볼 수 있어요" : "퀴즈를 풀고 카드로 확인해요";
  els.meaning.textContent = item.meaning || "뜻 정보 없음";
  els.synonym.textContent = item.synonyms ? `동의어: ${item.synonyms}` : "";
  answered = false;

  if (els.mode.value === "spell") renderSpell(item);
  if (els.mode.value === "match") renderMatch();
  if (els.mode.value === "flash") renderFlash();
}

function renderFlash() {
  els.panel.innerHTML = `
    <p class="quiz-title">카드 모드</p>
    <div class="choices">
      <button class="choice" type="button" data-mark="know">알고 있어요</button>
      <button class="choice" type="button" data-mark="again">한 번 더 볼래요</button>
    </div>
    <p class="feedback">카드를 뒤집어 뜻을 확인한 뒤 표시하세요.</p>
  `;
  els.panel.querySelector("[data-mark='know']").addEventListener("click", () => { mark(true); autoNext(350); });
  els.panel.querySelector("[data-mark='again']").addEventListener("click", () => { mark(false); autoNext(350); });
}

function renderChoice(item) {
  const pool = data.filter((candidate) => candidate.meaning && candidate.word !== item.word);
  const wrong = shuffleDeck(pool).slice(0, 3).map((candidate) => candidate.meaning);
  const choices = shuffleDeck([item.meaning, ...wrong]);
  els.panel.innerHTML = `
    <p class="quiz-title">뜻을 고르세요</p>
    <div class="choices">
      ${choices.map((choice) => `<button class="choice" type="button">${choice}</button>`).join("")}
    </div>
    <p class="feedback"></p>
  `;
  els.panel.querySelectorAll(".choice").forEach((button) => {
    button.addEventListener("click", () => {
      if (answered) return;
      const ok = button.textContent === item.meaning;
      button.classList.add(ok ? "correct" : "wrong");
      els.panel.querySelectorAll(".choice").forEach((choice) => {
        if (choice.textContent === item.meaning) choice.classList.add("correct");
      });
      setFeedback(ok, ok ? "정답입니다." : `정답: ${item.meaning}`);
    });
  });
}

function renderSpell(item) {
  els.panel.innerHTML = `
    <p class="quiz-title">뜻을 보고 영어 단어를 입력하세요</p>
    <div class="spell-box">
      <strong>${item.meaning}</strong>
      <input id="spellInput" autocomplete="off" spellcheck="false" placeholder="영어 단어">
      <button id="checkSpell" type="button">확인</button>
    </div>
    <p class="feedback"></p>
  `;
  const input = els.panel.querySelector("#spellInput");
  const check = () => {
    if (answered) return;
    const normalized = input.value.trim().toLowerCase();
    const answer = item.word.trim().toLowerCase();
    setFeedback(normalized === answer, normalized === answer ? "정답입니다." : `정답: ${item.word}`);
  };
  els.panel.querySelector("#checkSpell").addEventListener("click", check);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") check();
  });
  input.focus();
}

function compactSynonym(text) {
  return text
    .split(/[,/;]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(", ");
}

function renderMatch() {
  const pool = shuffleDeck(deck.filter((item) => item.synonyms && item.synonyms.trim()));
  const pairs = pool.slice(0, Math.min(6, pool.length));
  matchRound = shuffleDeck([
    ...pairs.map((item) => ({ id: item.word, type: "word", text: item.word })),
    ...pairs.map((item) => ({ id: item.word, type: "synonym", text: compactSynonym(item.synonyms) })),
  ]);
  selectedMatch = null;
  matchedPairs = new Set();

  els.cardMeta.textContent = "동의어 매칭";
  els.word.textContent = pairs.length ? "단어와 동의어를 짝지으세요" : "동의어 카드가 없어요";
  els.hint.textContent = pairs.length ? "한 장씩 눌러 같은 뜻의 쌍을 찾습니다" : "학술주제 교재를 선택해 보세요";
  els.meaning.textContent = "맞힌 쌍은 초록색으로 고정됩니다";
  els.synonym.textContent = "";

  if (!pairs.length) {
    els.panel.innerHTML = `
      <p class="quiz-title">동의어 매칭</p>
      <p class="feedback bad">선택한 범위에는 동의어 정보가 있는 카드가 없습니다.</p>
    `;
    return;
  }

  els.panel.innerHTML = `
    <p class="quiz-title">단어와 동의어 카드 맞추기</p>
    <div class="match-grid">
      ${matchRound.map((card, i) => `
        <button class="match-card" type="button" data-index="${i}" data-id="${card.id}">
          <span>${card.type === "word" ? "Word" : "Synonym"}</span>
          ${card.text}
        </button>
      `).join("")}
    </div>
    <p class="feedback">첫 번째 카드와 짝이 되는 카드를 누르세요.</p>
  `;

  els.panel.querySelectorAll(".match-card").forEach((button) => {
    button.addEventListener("click", () => handleMatchClick(button));
  });
}

function handleMatchClick(button) {
  if (button.classList.contains("matched")) return;
  const feedback = els.panel.querySelector(".feedback");

  if (!selectedMatch) {
    selectedMatch = button;
    button.classList.add("selected");
    feedback.textContent = "짝이 되는 카드를 고르세요.";
    feedback.className = "feedback";
    return;
  }

  if (selectedMatch === button) {
    selectedMatch.classList.remove("selected");
    selectedMatch = null;
    feedback.textContent = "첫 번째 카드와 짝이 되는 카드를 누르세요.";
    return;
  }

  const ok = selectedMatch.dataset.id === button.dataset.id;
  if (ok) {
    selectedMatch.classList.remove("selected");
    selectedMatch.classList.add("matched");
    button.classList.add("matched");
    matchedPairs.add(button.dataset.id);
    selectedMatch = null;
    score += 1;
    streak += 1;
    els.score.textContent = score;
    els.streak.textContent = streak;
    feedback.textContent = matchedPairs.size === matchRound.length / 2 ? "한 판 완료! 섞기를 누르면 새 판이 나옵니다." : "좋아요. 한 쌍을 맞혔습니다.";
    feedback.className = "feedback good";
    return;
  }

  button.classList.add("wrong");
  selectedMatch.classList.add("wrong");
  streak = 0;
  els.streak.textContent = streak;
  feedback.textContent = "다시 시도해 보세요.";
  feedback.className = "feedback bad";
  const previous = selectedMatch;
  selectedMatch = null;
  window.setTimeout(() => {
    button.classList.remove("wrong");
    previous.classList.remove("wrong", "selected");
  }, 650);
}

function setFeedback(ok, text) {
  answered = true;
  mark(ok);
  const feedback = els.panel.querySelector(".feedback");
  feedback.textContent = text;
  feedback.className = `feedback ${ok ? "good" : "bad"}`;
  if (!ok) els.card.classList.add("flipped");
  if (ok) autoNext(900);
}

function autoNext(delay) {
  if (!deck.length) return;
  const expected = index;
  window.setTimeout(() => {
    if (index === expected) move(1);
  }, delay);
}

function mark(ok) {
  if (answered && els.mode.value === "flash") return;
  answered = true;
  if (ok) {
    score += 1;
    streak += 1;
  } else {
    streak = 0;
  }
  els.score.textContent = score;
  els.streak.textContent = streak;
}

function move(step) {
  if (!deck.length) return;
  index = (index + step + deck.length) % deck.length;
  render();
}

els.card.addEventListener("click", () => els.card.classList.toggle("flipped"));
els.card.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") els.card.classList.toggle("flipped");
});
els.flip.addEventListener("click", () => els.card.classList.toggle("flipped"));
els.prev.addEventListener("click", () => move(-1));
els.next.addEventListener("click", () => move(1));
els.shuffle.addEventListener("click", () => {
  deck = shuffleDeck(deck);
  index = 0;
  render();
});
els.source.addEventListener("change", () => buildDeck());
els.day.addEventListener("change", () => buildDeck());
els.mode.addEventListener("change", () => render());

fillSelects();
buildDeck();
