import type { City, Difficulty, GameConfig, WeatherState } from './types';
import type { Profile, Storage } from './storage/storage';
import type { GameAudio } from './audio/audio';
import { createRng, pick } from './rng';
import { Session } from './game/session';
import { CITIES } from './weather/cities';
import { GameScreen } from './ui/gameScreen';
import { renderSetup } from './ui/setupScreen';
import { renderRoundSummary, renderCityBonus } from './ui/roundScreens';
import { renderFinal } from './ui/finalScreen';
import { PrepSession } from './prep/prepSession';
import { packShapes } from './prep/pack';
import type { Pack } from './prep/pack';
import { explain } from './prep/explain';
import { renderPrepPacks } from './ui/prepPacksScreen';
import { renderPrepEdit } from './ui/prepEditScreen';
import { renderPrepReview, renderPrepSummary } from './ui/prepEndScreens';

export interface AppDeps {
  storage: Storage;
  audio: Pick<GameAudio, 'start' | 'playSuccess' | 'pauseMusic' | 'resumeMusic' | 'setMuted' | 'muted'>;
  now: () => number;
  fetchWeather: (city: City, rngSeed: number) => Promise<WeatherState>;
  seed: () => number;
  roundCardMs?: number;
}

/**
 * Screen routing: setup -> game -> round summary -> city bonus -> (next round | final) -> setup.
 * Test prep: setup -> pack list -> (editor -> pack list | practice -> review if missed -> summary -> pack list | again).
 */
export function startApp(root: HTMLElement, deps: AppDeps): void {
  let session: Session | null = null;
  let game: GameScreen | null = null;
  let lastWeather: WeatherState = 'clear';
  let musicWanted = false;                               // true from the Start click until the final screen

  // Music follows the tab: silent while hidden on any screen. During a problem the game's own pause
  // overlay is up when the tab returns, and the music comes back with its "המשך" button instead.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) deps.audio.pauseMusic();
    else if (musicWanted && !game?.isPaused) deps.audio.resumeMusic();
  });

  const newGame = () => {
    musicWanted = false;
    deps.audio.pauseMusic();
    showSetup();
  };

  const showSetup = () => {
    game?.destroy(); game = null; session = null; musicWanted = false;
    renderSetup(root, deps.storage, startGame, showPacks);
  };

  const startGame = (config: GameConfig) => {
    deps.audio.start();                                  // inside the Start click: browsers allow audio now
    musicWanted = true;
    session = new Session(config, createRng(deps.seed()), CITIES);
    void playRound();
  };

  const playRound = async () => {
    const current = session!;
    game?.destroy();
    game = new GameScreen(root, current, {
      audio: deps.audio,
      now: deps.now,
      rng: createRng(deps.seed()),
      roundCardMs: deps.roundCardMs,
      onMuteChange: m => deps.storage.setMuted(m),
      onNewGame: newGame,
      fetchWeather: async city => (lastWeather = await deps.fetchWeather(city, deps.seed())),
      onRoundEnd: () => {
        game?.destroy(); game = null;
        renderRoundSummary(root, current, () => showCity(current), newGame);
      },
    });
    await game.start();
  };

  const showCity = (current: Session) => {
    current.advance();                                   // roundSummary -> cityBonus
    renderCityBonus(root, current, () => {
      if (current.phase === 'finished') {
        musicWanted = false;
        deps.audio.pauseMusic();
        renderFinal(root, current, deps.storage, showSetup);
      } else {
        void playRound();
      }
    }, { playSuccess: () => deps.audio.playSuccess(), weather: lastWeather, onNewGame: newGame });
  };

  // ---- test prep: pack list -> editor | practice -> review (when something was missed) -> summary -> pack list ----
  const showPacks = (player: Profile) => {
    renderPrepPacks(root, {
      player, packs: deps.storage.packs(player.name),
      onPlay: (pack, difficulty) => startPrep(player, pack, difficulty, true),
      onNew: () => editPack(player),
      onEdit: pack => editPack(player, pack),
      onDelete: pack => { deps.storage.deletePack(pack.id); showPacks(player); },
      onBack: showSetup,
    });
  };

  const editPack = (player: Profile, old?: Pack) => {
    const grade = old?.grade ?? player.grade;
    renderPrepEdit(root, {
      grade, pack: old,
      onSave: (name, examples) => {
        const kept = new Set(packShapes({ examples, grade }).map(s => s.key));
        const pack: Pack = old
          ? { ...old, name, examples, shapes: Object.fromEntries(Object.entries(old.shapes).filter(([k]) => kept.has(k))) }
          : { id: deps.seed().toString(36), owner: player.name, name, grade, examples, createdAt: new Date().toISOString(), shapes: {}, lastStars: null };
        if (deps.storage.savePack(pack)) showPacks(player);
        else startPrep(player, pack, 'beginner', false);       // nothing could be stored: practise it anyway
      },
      onCancel: () => showPacks(player),
    });
  };

  const startPrep = (player: Profile, pack: Pack, difficulty: Difficulty, saved: boolean) => {
    deps.audio.start();                                  // inside the שחק / שמירה click, as on התחל
    musicWanted = true;
    const rng = createRng(deps.seed());
    const prep = new PrepSession({ name: player.name, grade: pack.grade, difficulty, pack }, rng, pick(rng, CITIES));
    game?.destroy();
    game = new GameScreen(root, prep, {
      audio: deps.audio,
      now: deps.now,
      rng: createRng(deps.seed()),
      roundCardMs: deps.roundCardMs,
      onMuteChange: m => deps.storage.setMuted(m),
      onNewGame: newGame,                                // leaving mid-practice records nothing
      fetchWeather: city => deps.fetchWeather(city, deps.seed()),
      onRoundEnd: () => {
        game?.destroy(); game = null;
        musicWanted = false;
        deps.audio.pauseMusic();
        if (saved) deps.storage.recordPractice(pack.id, prep.results, prep.stars);
        const again = () => startPrep(player, saved ? deps.storage.packs(player.name).find(p => p.id === pack.id) ?? pack : pack, difficulty, saved);
        const summary = () => renderPrepSummary(root, {
          packName: pack.name, stars: prep.stars, asked: prep.asked, solved: prep.asked - prep.misses.length,
          perfect: prep.misses.length === 0, saved, onAgain: again, onBack: () => showPacks(player),
        });
        const items = prep.reviewItems();
        if (items.length > 0) renderPrepReview(root, { items, explain: m => explain(m.problem, m.picked), makeTwin: m => prep.makeTwin(m), onDone: summary });
        else summary();
      },
    });
    void game.start();
  };

  showSetup();
}
