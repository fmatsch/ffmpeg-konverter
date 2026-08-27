import { app, BrowserWindow, Menu, shell, type MenuItemConstructorOptions } from 'electron';
import { IPC } from '@shared/ipcChannels';
import type { AppSettings } from '@shared/types';

const isMac = process.platform === 'darwin';

interface MenuTexts {
  about: string;
  quit: string;
  edit: string;
  undo: string;
  redo: string;
  cut: string;
  copy: string;
  paste: string;
  selectAll: string;
  language: string;
  german: string;
  english: string;
  view: string;
  reload: string;
  toggleDevTools: string;
  window: string;
  minimize: string;
  close: string;
}

const TEXTS: Record<AppSettings['language'], MenuTexts> = {
  de: {
    about: 'Über FFmpeg Konverter',
    quit: 'Beenden',
    edit: 'Bearbeiten',
    undo: 'Rückgängig',
    redo: 'Wiederholen',
    cut: 'Ausschneiden',
    copy: 'Kopieren',
    paste: 'Einfügen',
    selectAll: 'Alles auswählen',
    language: 'Sprache',
    german: 'Deutsch',
    english: 'Englisch',
    view: 'Ansicht',
    reload: 'Neu laden',
    toggleDevTools: 'Entwicklertools',
    window: 'Fenster',
    minimize: 'Minimieren',
    close: 'Schließen'
  },
  en: {
    about: 'About FFmpeg Konverter',
    quit: 'Quit',
    edit: 'Edit',
    undo: 'Undo',
    redo: 'Redo',
    cut: 'Cut',
    copy: 'Copy',
    paste: 'Paste',
    selectAll: 'Select All',
    language: 'Language',
    german: 'German',
    english: 'English',
    view: 'View',
    reload: 'Reload',
    toggleDevTools: 'Toggle Developer Tools',
    window: 'Window',
    minimize: 'Minimize',
    close: 'Close'
  }
};

export function buildAppMenu(
  window: BrowserWindow,
  language: AppSettings['language'],
  onLanguageSelect: (lang: AppSettings['language']) => void
): void {
  const t = TEXTS[language];

  const languageSubmenu: MenuItemConstructorOptions[] = [
    {
      label: t.german,
      type: 'radio',
      checked: language === 'de',
      click: () => onLanguageSelect('de')
    },
    {
      label: t.english,
      type: 'radio',
      checked: language === 'en',
      click: () => onLanguageSelect('en')
    }
  ];

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { label: t.about, role: 'about' as const },
              { type: 'separator' as const },
              { label: t.language, submenu: languageSubmenu },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { label: t.quit, role: 'quit' as const }
            ]
          }
        ]
      : []),
    {
      label: t.edit,
      submenu: [
        { label: t.undo, role: 'undo' },
        { label: t.redo, role: 'redo' },
        { type: 'separator' },
        { label: t.cut, role: 'cut' },
        { label: t.copy, role: 'copy' },
        { label: t.paste, role: 'paste' },
        { label: t.selectAll, role: 'selectAll' }
      ]
    },
    ...(!isMac ? [{ label: t.language, submenu: languageSubmenu }] : []),
    {
      label: t.view,
      submenu: [
        { label: t.reload, role: 'reload' },
        { label: t.toggleDevTools, role: 'toggleDevTools' }
      ]
    },
    {
      label: t.window,
      submenu: [
        { label: t.minimize, role: 'minimize' },
        { label: t.close, role: 'close' }
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'FFmpeg',
          click: () => {
            void shell.openExternal('https://ffmpeg.org/');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  window.webContents.send(IPC.languageChanged, language);
}
