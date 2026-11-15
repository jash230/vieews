// Shell scripts the clipping sandbox runs. Kept pure (strings in, strings out) so they can be tested.
// Each phase runs detached and writes `<phase>.done` holding its exit code, so a workflow step can
// wait on it in bounded chunks instead of holding one function open for a long download or render.

/** Working directory inside the sandbox. */
export const WORKDIR = "/vercel/sandbox/clip";

/** Longest source video accepted, in seconds. */
export const MAX_SOURCE_S = 2 * 60 * 60;

/** Each clip must fit Supabase Free's 50 MB file cap, with headroom. */
export const CLIP_MAX_BYTES = 45 * 1024 * 1024;

const FONT_URL = "https://github.com/JulietaUla/Montserrat/raw/master/fonts/ttf/Montserrat-ExtraBold.ttf";
const YTDLP_URL = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux";

/** Quotes one argument for bash. */
export function shq(arg: string): string {
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

/** Wraps a script so it runs in WORKDIR, logs to `<phase>.log`, and records its exit code in `<phase>.done`. */
export function detachedCommand(phase: string): string[] {
  return ["-c", `cd ${WORKDIR} && rm -f ${phase}.done && bash ${phase}.sh > ${phase}.log 2>&1; echo $? > ${phase}.done`];
}

export type Source = { kind: "link"; url: string } | { kind: "file"; url: string };

/**
 * Installs ffmpeg, the caption font and yt-dlp, downloads the source to src.mp4, and extracts a small
 * mono audio track for transcription. Writes the duration to duration.txt and the title to title.txt.
 */
export function prepareScript(source: Source): string {
  const download =
    source.kind === "link"
      ? [
          // Node is in the image; yt-dlp needs a JS runtime for some YouTube formats.
          `./yt-dlp --no-playlist --no-progress --restrict-filenames --js-runtimes node \\`,
          `  --match-filter ${shq(`duration <= ${MAX_SOURCE_S}`)} \\`,
          `  -f ${shq("bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080][ext=mp4]/bv*[height<=1080]+ba/b")} \\`,
          `  --merge-output-format mp4 --print-to-file ${shq("%(title)s")} title.txt \\`,
          `  -o src.mp4 ${shq(source.url)}`,
          `[ -s src.mp4 ] || { echo "DOWNLOAD_FAILED: nothing was downloaded (too long, private, or blocked)"; exit 3; }`,
        ]
      : [`curl -fsSL --retry 3 -o src.mp4 ${shq(source.url)}`];
  return [
    "set -euo pipefail",
    "export DEBIAN_FRONTEND=noninteractive",
    "if ! command -v ffmpeg >/dev/null; then",
    "  (sudo apt-get update -qq && sudo -E apt-get install -y -qq ffmpeg) || (sudo dnf install -y -q ffmpeg-free || sudo dnf install -y -q ffmpeg)",
    "fi",
    "mkdir -p fonts",
    `[ -s fonts/Montserrat-ExtraBold.ttf ] || curl -fsSL --retry 3 -o fonts/Montserrat-ExtraBold.ttf ${shq(FONT_URL)}`,
    ...(source.kind === "link" ? [`[ -x yt-dlp ] || { curl -fsSL --retry 3 -o yt-dlp ${shq(YTDLP_URL)} && chmod +x yt-dlp; }`] : []),
    ...download,
    "ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 src.mp4 > duration.txt",
    `awk '{ if ($1 > ${MAX_SOURCE_S}) { print "TOO_LONG: the video is over 2 hours"; exit 4 } }' duration.txt`,
    "ffmpeg -y -v error -i src.mp4 -vn -ac 1 -ar 16000 -b:a 48k audio.mp3",
  ].join("\n");
}

/** Sends audio.mp3 to Deepgram and saves the response as transcript.json. DEEPGRAM_API_KEY comes from the command's env. */
export function transcribeScript(): string {
  const url = "https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true&detect_language=true";
  return [
    "set -euo pipefail",
    `curl -fsS --retry 2 --max-time 1500 -X POST ${shq(url)} \\`,
    `  -H "Authorization: Token $DEEPGRAM_API_KEY" -H 'Content-Type: audio/mpeg' \\`,
    "  --data-binary @audio.mp3 -o transcript.json",
  ].join("\n");
}

/** Video bitrate (kbps) that keeps a clip of this length under CLIP_MAX_BYTES with 128k audio. */
export function videoKbps(durationS: number): number {
  const totalKbps = Math.floor((CLIP_MAX_BYTES * 8) / 1000 / Math.max(1, durationS));
  return Math.max(800, Math.min(6000, totalKbps - 160));
}

/** The -vf chain: centre-crop to 9:16 (or keep an already-vertical frame), scale to 1080x1920, burn captions. */
export function clipFilter(assFile: string): string {
  return [
    "crop=w=min(iw\\,ih*9/16):h=min(ih\\,iw*16/9)",
    "scale=1080:1920:flags=lanczos",
    "setsar=1",
    `subtitles=${assFile}:fontsdir=fonts`,
  ].join(",");
}

/** Cuts one clip from src.mp4 to clip-<n>.mp4 with captions from clip-<n>.ass, plus a poster frame clip-<n>.jpg. */
export function renderScript(n: number, startS: number, endS: number): string {
  const dur = Math.max(0.5, endS - startS);
  const kbps = videoKbps(dur);
  return [
    "set -euo pipefail",
    [
      "ffmpeg -y -v error",
      `-ss ${startS.toFixed(3)} -i src.mp4 -t ${dur.toFixed(3)}`,
      `-vf ${shq(clipFilter(`clip-${n}.ass`))}`,
      "-r 30 -c:v libx264 -preset veryfast -pix_fmt yuv420p",
      `-b:v ${kbps}k -maxrate ${kbps}k -bufsize ${kbps * 2}k`,
      "-c:a aac -b:a 128k -ac 2 -movflags +faststart",
      `clip-${n}.mp4`,
    ].join(" "),
    // A start past the end of the video writes an MP4 with no streams; fail instead of uploading it.
    `ffprobe -v error -select_streams v -show_entries stream=codec_name -of csv=p=0 clip-${n}.mp4 | grep -q . || { echo "EMPTY_CLIP: nothing to render in this range"; exit 5; }`,
    `ffmpeg -y -v error -ss ${Math.min(1, dur / 2).toFixed(2)} -i clip-${n}.mp4 -frames:v 1 -vf scale=540:-2 -q:v 4 clip-${n}.jpg`,
  ].join("\n");
}

/** Bash that waits up to `seconds` for `<phase>.done`. Exits 0 when it's there, 99 when still running. */
export function waitScript(phase: string, seconds: number): string[] {
  const tries = Math.max(1, Math.floor(seconds / 2));
  return ["-c", `cd ${WORKDIR} && for i in $(seq 1 ${tries}); do [ -f ${phase}.done ] && exit 0; sleep 2; done; exit 99`];
}
