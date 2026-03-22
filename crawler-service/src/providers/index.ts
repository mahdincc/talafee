export { DigiGoldProvider } from './DigiGoldProvider.js';
export { TalineProvider } from './TalineProvider.js';
export { MelligoldProvider } from './MelligoldProvider.js';
export { MiligoldProvider } from './MiligoldProvider.js';
export { TalaSeaProvider } from './TalaSeaProvider.js';
export { TechnoGoldProvider } from './TechnoGoldProvider.js';
export { BonbastProvider } from './BonbastProvider.js';
export { AlanchandProvider } from './AlanchandProvider.js';
export { TGJUProvider } from './TGJUProvider.js';
export { GoldikaProvider } from './GoldikaProvider.js';
export { DaricProvider } from './DaricProvider.js';
export { GoldisProvider } from './GoldisProvider.js';

import type { IProvider } from '../core/interfaces/index.js';
import { DigiGoldProvider } from './DigiGoldProvider.js';
import { TalineProvider } from './TalineProvider.js';
import { MelligoldProvider } from './MelligoldProvider.js';
import { MiligoldProvider } from './MiligoldProvider.js';
import { TalaSeaProvider } from './TalaSeaProvider.js';
import { TechnoGoldProvider } from './TechnoGoldProvider.js';
import { BonbastProvider } from './BonbastProvider.js';
import { AlanchandProvider } from './AlanchandProvider.js';
import { TGJUProvider } from './TGJUProvider.js';
import { GoldikaProvider } from './GoldikaProvider.js';
import { DaricProvider } from './DaricProvider.js';
import { GoldisProvider } from './GoldisProvider.js';

export function createAllProviders(): IProvider[] {
  return [
    new DigiGoldProvider(),
    new TalineProvider(),
    new MelligoldProvider(),
    new MiligoldProvider(),
    new TalaSeaProvider(),
    new TechnoGoldProvider(),
    new BonbastProvider(),
    new AlanchandProvider(),
    new TGJUProvider(),
    new GoldikaProvider(),
    new DaricProvider(),
    new GoldisProvider(),
  ];
}

export function createProviderById(providerId: string): IProvider | undefined {
  switch (providerId) {
    case 'digigold':
      return new DigiGoldProvider();
    case 'taline':
      return new TalineProvider();
    case 'melligold':
      return new MelligoldProvider();
    case 'miligold':
      return new MiligoldProvider();
    case 'talasea':
      return new TalaSeaProvider();
    case 'technogold':
      return new TechnoGoldProvider();
    case 'bonbast':
      return new BonbastProvider();
    case 'alanchand':
      return new AlanchandProvider();
    case 'tgju':
      return new TGJUProvider();
    case 'goldika':
      return new GoldikaProvider();
    case 'daric':
      return new DaricProvider();
    case 'goldis':
      return new GoldisProvider();
    default:
      return undefined;
  }
}
