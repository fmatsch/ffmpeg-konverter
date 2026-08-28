export const IPC = {
  selectInputFiles: 'dialog:selectInputFiles',
  selectOutputDir: 'dialog:selectOutputDir',
  probeFile: 'ffmpeg:probeFile',
  startQueue: 'queue:start',
  cancelJob: 'queue:cancelJob',
  cancelAll: 'queue:cancelAll',
  pauseJob: 'queue:pauseJob',
  resumeJob: 'queue:resumeJob',
  jobUpdate: 'queue:jobUpdate',
  getAppSettings: 'settings:get',
  setAppSettings: 'settings:set',
  getPresets: 'presets:get',
  savePreset: 'presets:save',
  deletePreset: 'presets:delete',
  openPath: 'shell:openPath',
  showItemInFolder: 'shell:showItemInFolder',
  languageChanged: 'app:languageChanged'
} as const;
