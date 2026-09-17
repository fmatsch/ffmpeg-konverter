declare module 'ffmpeg-static' {
  const path: string;
  export default path;
}

declare module '@ffprobe-installer/ffprobe' {
  const ffprobe: { path: string; version: string; url: string };
  export default ffprobe;
}
