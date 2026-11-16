import type { City, GameConfig, WeatherState } from './types';
import type { Storage } from './storage/storage';
import type { GameAudio } from './audio/audio';
import { createRng } from './rng';
import { Session } from './game/session';
import { CITIES } from './weather/cities';
import { GameScreen } from './ui/gameScreen';
import { renderSetup } from './ui/setupScreen';
import { renderRoundSummary, renderCityBonus } from './ui/roundScreens';
import { renderFinal } from './ui/finalScreen';

export interface AppDeps {
  storage: Storage;
  audio: Pick<GameAudio, 'start' | 'playSuccess' | 'pauseMusic' | 'resumeMusic' | 'setMuted' | 'muted'>;
  now: () => number;
  fetchWeather: (city: City, rngSeed: number) => Promise<WeatherState>;
  seed: () => number;
  roundCardMs?: number;
}

/** Screen routing: setup -> game -> round summary -> city bonus -> (next round | final) -> setup. */
export function startApp(root: HTMLElement, deps: AppDeps): void {
  let session: Session | null = null;
  let game: GameScreen | null = null;
  let lastWeather: WeatherState = 'clear';

  const showSetup = () => {
    game?.destroy(); game = null; session = null;
    renderSetup(root, deps.storage, startGame);
  };

  const startGame = (config: GameConfig) => {
    deps.audio.start();                                  // inside the Start click: browsers allow audio now
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
      fetchWeather: async city => (lastWeather = await deps.fetchWeather(city, deps.seed())),
      onRoundEnd: () => {
        game?.destroy(); game = null;
        renderRoundSummary(root, current, () => showCity(current));
      },
    });
    await game.start();
  };

  const showCity = (current: Session) => {
    current.advance();                                   // roundSummary -> cityBonus
    renderCityBonus(root, current, () => {
      if (current.phase === 'finished') {
        deps.audio.pauseMusic();
        renderFinal(root, current, deps.storage, showSetup);
      } else {
        void playRound();
      }
    }, { playSuccess: () => deps.audio.playSuccess(), weather: lastWeather });
  };

  showSetup();
}
