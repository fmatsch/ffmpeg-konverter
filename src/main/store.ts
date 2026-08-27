import Store from 'electron-store';
import { randomUUID } from 'node:crypto';
import type { AppSettings, Preset } from '@shared/types';
import { createDefaultAppSettings } from '@shared/types';

interface StoreSchema {
  appSettings: AppSettings;
  customPresets: Preset[];
}

const store = new Store<StoreSchema>({
  name: 'ffmpeg-konverter-config',
  defaults: {
    appSettings: createDefaultAppSettings(),
    customPresets: []
  }
});

export function getAppSettings(): AppSettings {
  return { ...createDefaultAppSettings(), ...store.get('appSettings') };
}

export function setAppSettings(settings: AppSettings): void {
  store.set('appSettings', settings);
}

export function getCustomPresets(): Preset[] {
  return store.get('customPresets');
}

export function saveCustomPreset(preset: Omit<Preset, 'id' | 'builtIn'>): Preset {
  const presets = getCustomPresets();
  const newPreset: Preset = { ...preset, id: randomUUID(), builtIn: false };
  presets.push(newPreset);
  store.set('customPresets', presets);
  return newPreset;
}

export function deleteCustomPreset(id: string): void {
  const presets = getCustomPresets().filter((p) => p.id !== id);
  store.set('customPresets', presets);
}
