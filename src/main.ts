import './styles.css';
import { startApp } from './app';
import { renderDebugScene } from './ui/debugScene';
import { Storage } from './storage/storage';
import { GameAudio } from './audio/audio';
import { fetchWeather } from './weather/weather';
import { createRng } from './rng';

const app = document.getElementById('app')!;

if (new URLSearchParams(location.search).get('debug') === 'scene') {
  renderDebugScene(app);
} else {
  const storage = new Storage();
  startApp(app, {
    storage,
    audio: new GameAudio(storage.muted()),
    now: () => performance.now(),
    fetchWeather: (city, seed) => fetchWeather(city, createRng(seed)),
    seed: () => (Math.random() * 2 ** 32) >>> 0,
  });
}
