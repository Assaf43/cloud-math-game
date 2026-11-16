import './styles.css';
import { renderDebugScene } from './ui/debugScene';

const app = document.getElementById('app')!;

// Screen routing lives here. The game flow is wired up in later tasks.
if (new URLSearchParams(location.search).get('debug') === 'scene') renderDebugScene(app);
