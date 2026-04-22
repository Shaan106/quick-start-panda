import { Game } from './game';

const canvas = document.getElementById('game') as HTMLCanvasElement | null;
if (!canvas) throw new Error('canvas not found');
const game = new Game(canvas);
game.start();
