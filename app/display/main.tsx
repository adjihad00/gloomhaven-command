import { render } from 'preact';
import { App } from './App';
import { registerServiceWorker } from '../shared/swRegistration';

render(<App />, document.getElementById('root')!);

registerServiceWorker({ swPath: '/app/display/sw.js', scope: '/display' });
