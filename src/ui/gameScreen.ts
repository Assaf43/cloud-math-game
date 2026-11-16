import type { City, Rng, WeatherState } from '../types';
import type { Session } from '../game/session';
import type { GameAudio } from '../audio/audio';
import { SceneView } from '../scene/sceneView';
import { makeLane, slotLayout } from '../scene/clouds';
import { timeOfDay } from '../scene/timeOfDay';
import { newGameControl } from './newGameControl';

export interface GameScreenDeps {
  audio: Pick<GameAudio, 'playSuccess' | 'pauseMusic' | 'resumeMusic' | 'setMuted' | 'muted'>;
  now: () => number;
  fetchWeather: (city: City) => Promise<WeatherState>;
  onRoundEnd: () => void;
  rng: Rng;                              // for cloud lanes
  onMuteChange?: (muted: boolean) => void;
  onNewGame?: () => void;                // offered in the pause menu, after a confirmation
  roundCardMs?: number;                  // how long the "סבב N" card shows (0 = none)
}

const REVEAL_MS = 1500;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * One round of play: weather, problems, timer, pause. The player answers by tapping (or clicking) the cloud-hidden
 * answer they think is right. A cloud on top of an answer blocks the tap, so only what is visible can be chosen.
 */
export class GameScreen {
  private readonly root: HTMLElement;
  private readonly session: Session;
  private readonly deps: GameScreenDeps;

  private readonly game = el('div', 'game');
  private readonly statusName = el('span', 'status-name');
  private readonly statusRound = el('span', 'status-round');
  private readonly statusProblem = el('span', 'status-problem');
  private readonly statusScore = el('span', 'status-score');
  private readonly muteBtn = el('button', 'mute-btn');
  private readonly pauseBtn = el('button', 'pause-btn', '⏸');
  private readonly sceneRoot = el('div', 'game-sky');
  private readonly problemEl = el('div', 'problem');
  private readonly timerBar = el('div', 'timer-bar');
  private readonly pauseOverlay = el('div', 'overlay pause-overlay');
  private readonly resumeBtn = el('button', 'primary', 'המשך');
  private readonly roundCard = el('div', 'overlay round-card');
  private readonly scene: SceneView;

  private startedAt = 0;
  private pausedAt: number | null = null;
  private pausedTotal = 0;
  private frameId: number | null = null;
  private revealTimer: ReturnType<typeof setTimeout> | null = null;
  private revealStartedAt = 0;
  private revealRemaining = REVEAL_MS;
  private destroyed = false;
  private started = false;

  private readonly onVisibility = () => { if (document.hidden) this.pause(); };

  constructor(root: HTMLElement, session: Session, deps: GameScreenDeps) {
    this.root = root;
    this.session = session;
    this.deps = deps;
    this.scene = new SceneView(this.sceneRoot);
    this.scene.onPick = text => this.choose(text);
    this.build();
  }

  /** Fetches this round's weather, shows the scene and begins the first problem. */
  async start(): Promise<void> {
    if (this.destroyed) return;
    const weather = await this.deps.fetchWeather(this.session.city);
    if (this.destroyed) return;
    this.scene.setBackdrop(timeOfDay(new Date()), weather, this.session.city.id);
    const cardMs = this.deps.roundCardMs ?? 1200;
    if (cardMs > 0) {
      this.roundCard.textContent = `סבב ${this.session.roundIndex + 1}`;
      this.roundCard.hidden = false;
      await new Promise<void>(resolve => setTimeout(resolve, cardMs));
      this.roundCard.hidden = true;
      if (this.destroyed) return;
    }
    document.addEventListener('visibilitychange', this.onVisibility);
    this.started = true;
    this.beginProblem();
    this.loop();
    // The tab may have been hidden while the weather loaded: start paused, so the child finds the problem waiting.
    if (document.hidden) this.pause();
  }

  pause(): void {
    if (this.destroyed || !this.started || this.pausedAt !== null) return;
    this.pausedAt = this.deps.now();
    if (this.revealTimer !== null) {
      clearTimeout(this.revealTimer);
      this.revealTimer = null;
      this.revealRemaining = Math.max(0, REVEAL_MS - (this.pausedAt - this.revealStartedAt));
    }
    this.deps.audio.pauseMusic();
    this.game.classList.add('is-paused');
    this.pauseOverlay.hidden = false;
    this.resumeBtn.focus();                                              // keyboard users can resume with Enter/Space
  }

  get isPaused(): boolean { return this.pausedAt !== null; }

  resume(): void {
    if (this.destroyed || this.pausedAt === null) return;
    const now = this.deps.now();
    this.pausedTotal += now - this.pausedAt;
    this.pausedAt = null;
    this.deps.audio.resumeMusic();
    this.game.classList.remove('is-paused');
    this.pauseOverlay.hidden = true;
    this.resumeBtn.blur();
    if (this.session.phase === 'reveal') this.armReveal(this.revealRemaining);
  }

  destroy(): void {
    this.destroyed = true;
    document.removeEventListener('visibilitychange', this.onVisibility);
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    if (this.revealTimer !== null) clearTimeout(this.revealTimer);
    this.frameId = null; this.revealTimer = null;
    this.root.replaceChildren();
  }

  // ---- layout ---------------------------------------------------------------
  private build(): void {
    const status = el('header', 'status');
    this.statusName.textContent = this.session.config.name;            // player text: always textContent
    this.muteBtn.type = 'button';
    this.muteBtn.setAttribute('aria-label', 'השתק');
    this.muteBtn.addEventListener('click', () => this.toggleMute());
    this.renderMute();
    this.pauseBtn.type = 'button';
    this.pauseBtn.setAttribute('aria-label', 'השהיה');
    this.pauseBtn.addEventListener('click', () => this.pause());
    status.append(this.statusName, this.statusRound, this.statusProblem, this.statusScore, this.muteBtn, this.pauseBtn);

    this.problemEl.dir = 'auto';
    const timer = el('div', 'timer');
    timer.append(this.timerBar);

    this.pauseOverlay.hidden = true;
    this.pauseOverlay.append(el('p', 'overlay-title', 'המשחק מושהה'));
    this.resumeBtn.type = 'button';
    this.resumeBtn.addEventListener('click', () => this.resume());
    this.pauseOverlay.append(this.resumeBtn);
    if (this.deps.onNewGame) this.pauseOverlay.append(newGameControl(this.deps.onNewGame));
    this.roundCard.hidden = true;

    this.game.append(status, this.sceneRoot, this.problemEl, timer, this.pauseOverlay, this.roundCard);
    this.root.replaceChildren(this.game);
    this.updateStatus();
  }

  private toggleMute(): void {
    const next = !this.deps.audio.muted;
    this.deps.audio.setMuted(next);
    this.deps.onMuteChange?.(next);
    this.renderMute();
    this.muteBtn.blur();                                                 // hand focus back to the page
  }

  private renderMute(): void {
    const muted = this.deps.audio.muted;
    this.muteBtn.setAttribute('aria-pressed', String(muted));
    this.muteBtn.textContent = muted ? '🔇' : '🔊';
  }

  private updateStatus(): void {
    const s = this.session;
    this.statusRound.textContent = `סבב ${s.roundIndex + 1} מתוך ${s.config.rounds}`;
    this.statusProblem.textContent = `תרגיל ${s.problemIndex + 1} מתוך ${s.problemsInRound}`;
    this.statusScore.textContent = `ניקוד: ${s.totalScore}`;
  }

  // ---- problem flow ----------------------------------------------------------------
  private beginProblem(): void {
    const { problem } = this.session;
    this.problemEl.textContent = problem.text;
    const slots = slotLayout(problem.choices.length as 4 | 5 | 6);
    this.scene.setAnswers(problem.choices, slots, slots.map(slot => makeLane(slot, this.deps.rng)));
    this.startedAt = this.deps.now();
    this.pausedTotal = 0;
    this.pausedAt = null;
    this.updateStatus();
    this.paint();
  }

  private elapsed(): number {
    return (this.pausedAt ?? this.deps.now()) - this.startedAt - this.pausedTotal;
  }

  private loop = (): void => {
    if (this.destroyed) return;
    this.paint();
    if (this.pausedAt === null && this.session.phase === 'problem' && this.elapsed() >= this.session.config.secondsPerProblem * 1000) {
      this.session.timeout();
      this.afterResult();
    }
    this.frameId = requestAnimationFrame(this.loop);
  };

  private paint(): void {
    const limit = this.session.config.secondsPerProblem * 1000;
    const elapsed = this.elapsed();
    this.scene.render(Math.max(0, elapsed));
    if (this.session.phase === 'problem') {
      const pct = Math.min(100, Math.max(0, (1 - elapsed / limit) * 100));
      this.timerBar.style.width = `${Math.round(pct * 100) / 100}%`;
      this.timerBar.classList.toggle('is-low', pct < 25);
    }
  }

  /** The player tapped an answer. One attempt: correct scores, wrong does not; neither makes a sound but the success chime. */
  private choose(text: string): void {
    if (this.destroyed || !this.started || this.pausedAt !== null || this.session.phase !== 'problem') return;
    const result = this.session.choose(text, Math.max(0, this.elapsed()));
    if (result === 'invalid') return;
    if (result === 'correct') this.deps.audio.playSuccess();
    else this.scene.markWrong(text);
    this.afterResult();
  }

  /** After a correct, wrong or timed-out problem: show the answer, then move on. */
  private afterResult(): void {
    this.scene.highlight(this.session.problem.answer.text);
    this.updateStatus();
    this.revealStartedAt = this.deps.now();
    this.revealRemaining = REVEAL_MS;
    this.armReveal(REVEAL_MS);
  }

  private armReveal(ms: number): void {
    if (this.revealTimer !== null) clearTimeout(this.revealTimer);
    this.revealStartedAt = this.deps.now() - (REVEAL_MS - ms);
    this.revealTimer = setTimeout(() => {
      this.revealTimer = null;
      if (this.destroyed) return;
      this.session.advance();
      if (this.session.phase === 'problem') this.beginProblem();
      else this.deps.onRoundEnd();
    }, ms);
  }
}
