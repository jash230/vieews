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

export type Source = { kind: "link"; url: string } | { kind: "file"; url: string };

/** Quotes one argument for bash. */
export function shq(arg: string): string {
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

/** Wraps a script so it runs in WORKDIR, logs to `<phase>.log`, and records its exit code in `<phase>.done`. */
export function detachedCommand(phase: string): string[] {
  return ["-c", `cd ${WORKDIR} && rm -f ${phase}.done && bash ${phase}.sh > ${phase}.log 2>&1; echo $? > ${phase}.done`];
}

/** Largest source file fetched. A 2-hour 1080p video fits. */
export const MAX_SOURCE_BYTES = 4 * 1024 ** 3;

const WIREPROXY_URL = "https://github.com/windtf/wireproxy/releases/download/v1.1.3/wireproxy_linux_amd64.tar.gz";
const WARP_PROXY = "http://127.0.0.1:40000";

/**
 * Routes yt-dlp through Cloudflare WARP when WARP_PROFILE_B64 (a base64 wgcf WireGuard profile) is in the env.
 * The sandbox has no kernel WireGuard, so wireproxy runs the tunnel in userspace as a local http proxy (ffmpeg can't use SOCKS).
 * If the tunnel doesn't come up, YTDLP_PROXY is left as it was. Safe to run in every phase: it reuses a live tunnel.
 * The route taken is written to route.txt.
 */
const WARP_UP = [
  "warp_up() {",
  `  [ -n "\${WARP_PROFILE_B64:-}" ] || return 0`,
  `  warp_ok() { curl -fs --max-time 4 -x ${WARP_PROXY} https://www.cloudflare.com/cdn-cgi/trace | grep -q warp=on; }`,
  "  if ! warp_ok; then",
  `    [ -x wireproxy ] || curl -fsSL --retry 3 ${shq(WIREPROXY_URL)} | tar xz wireproxy`,
  // IPv4 only: measured 2026-11-16, YouTube bot-checks WARP's IPv6 exits and lets the IPv4 ones through.
  `    { echo "$WARP_PROFILE_B64" | base64 -d | sed -E 's/^(Address = [0-9.\\/]+),.*/\\1/; s/^(DNS = [0-9., ]*[0-9]),.*/\\1/'; printf '\\n[http]\\nBindAddress = ${WARP_PROXY.slice(7)}\\n'; } > warp.conf`,
  "    nohup ./wireproxy -c warp.conf > warp.log 2>&1 &",
  "    for i in $(seq 1 20); do warp_ok && break; sleep 0.5; done",
  "  fi",
  `  if warp_ok; then export YTDLP_PROXY=${WARP_PROXY}; echo warp > route.txt; else echo "warp-failed, using $([ -n "\${YTDLP_PROXY:-}" ] && echo proxy || echo direct)" > route.txt; fi`,
  "}",
  // "|| true": a broken tunnel must never fail the job, it only loses the WARP route.
  `warp_up || true; echo "ROUTE: $(cat route.txt 2>/dev/null || echo "$([ -n "\${YTDLP_PROXY:-}" ] && echo proxy || echo direct)")"`,
];

/** yt-dlp with the flags every call shares. YTDLP_PROXY comes from the env (or WARP_UP) so its credentials never land in the script; YouTube refuses Vercel's IPs without one. */
const YTDLP =`./yt-dlp \${YTDLP_PROXY:+--proxy "$YTDLP_PROXY"} --no-playlist --no-progress --restrict-filenames --js-runtimes node -N 4`;

/**
 * Installs ffmpeg, the caption font and yt-dlp, downloads the source to src.mp4, and extracts a small
 * mono audio track for transcription. Writes the duration to duration.txt and the title to title.txt.
 * For a link, src.mp4 holds the audio only: proxy traffic is the main cost, so the picture is fetched
 * later, and only for the moments that become clips (see renderScript).
 * With `haveTranscript` (a link whose transcript is already known) nothing is downloaded: only the tools are installed.
 */
export function prepareScript(source: Source, haveTranscript = false): string {
  const download =
    source.kind === "link"
      ? [
          // "<=?" lets a direct file link through when its length is unknown; ffprobe below enforces the cap.
          `${YTDLP} --match-filter ${shq(`duration <=? ${MAX_SOURCE_S}`)} --max-filesize ${MAX_SOURCE_BYTES} \\`,
          // A ~64k track is plenty for transcription and half the bytes. The saved lookup (src.mp4.info.json) spares each clip ~10s of asking the site again.
          `  -f ${shq("ba[abr<=70]/ba/b")} --write-info-json --print-to-file ${shq("%(title)s")} title.txt -o src.mp4 ${shq(source.url)}`,
          `[ -s src.mp4 ] || { echo "DOWNLOAD_FAILED: nothing was downloaded (too long, too big, private, or blocked)"; exit 3; }`,
        ]
      : [`curl -fsSL --retry 3 --max-filesize ${MAX_SOURCE_BYTES} -o src.mp4 ${shq(source.url)}`];
  return [
    "set -euo pipefail",
    "export DEBIAN_FRONTEND=noninteractive",
    "if ! command -v ffmpeg >/dev/null; then",
    "  (sudo apt-get update -qq && sudo -E apt-get install -y -qq ffmpeg) || (sudo dnf install -y -q ffmpeg-free || sudo dnf install -y -q ffmpeg)",
    "fi",
    "mkdir -p fonts",
    `[ -s fonts/Montserrat-ExtraBold.ttf ] || curl -fsSL --retry 3 -o fonts/Montserrat-ExtraBold.ttf ${shq(FONT_URL)}`,
    ...(source.kind === "link" ? [`[ -x yt-dlp ] || { curl -fsSL --retry 3 -o yt-dlp ${shq(YTDLP_URL)} && chmod +x yt-dlp; }`, ...WARP_UP] : []),
    ...(haveTranscript
      ? []
      : [
          ...download,
          "ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 src.mp4 > duration.txt",
          `awk '{ if ($1 > ${MAX_SOURCE_S}) { print "TOO_LONG: the video is over 2 hours"; exit 4 } }' duration.txt`,
          "ffmpeg -y -v error -i src.mp4 -vn -ac 1 -ar 16000 -b:a 48k audio.mp3",
        ]),
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

/**
 * Cuts one clip to clip-<n>.mp4 with captions from clip-<n>.ass, plus a poster frame clip-<n>.jpg.
 * An upload is cut from src.mp4. A link (`linkUrl`) has only its audio on disk, so just this moment is downloaded first, at 720p.
 */
export function renderScript(n: number, startS: number, endS: number, linkUrl?: string): string {
  const dur = Math.max(0.5, endS - startS);
  const kbps = videoKbps(dur);
  const input = linkUrl ? `clip-${n}-src.mp4` : "src.mp4";
  return [
    "set -euo pipefail",
    ...(linkUrl
      ? [
          ...WARP_UP,
          // "res" is the shorter side, so a vertical video keeps 720 across instead of 720 tall.
          // No --force-keyframes-at-cuts: measured on YouTube, the plain cut already starts within a frame of startS, and forcing re-encodes every clip twice.
          `get() { ${YTDLP} -f ${shq("bv*+ba/b")} -S res:720 --download-sections ${shq(`*${startS.toFixed(3)}-${endS.toFixed(3)}`)} --merge-output-format mp4 -o ${input} "$@"; }`,
          `get --load-info-json src.mp4.info.json || get ${shq(linkUrl)}`,
          `[ -s ${input} ] || { echo "DOWNLOAD_FAILED: this moment could not be downloaded"; exit 3; }`,
        ]
      : []),
    [
      "ffmpeg -y -v error",
      `-ss ${(linkUrl ? 0 : startS).toFixed(3)} -i ${input} -t ${dur.toFixed(3)}`,
      `-vf ${shq(clipFilter(`clip-${n}.ass`))}`,
      "-r 30 -c:v libx264 -preset veryfast -pix_fmt yuv420p",
      `-b:v ${kbps}k -maxrate ${kbps}k -bufsize ${kbps * 2}k`,
      "-c:a aac -b:a 128k -ac 2 -movflags +faststart",
      `clip-${n}.mp4`,
    ].join(" "),
    // A start past the end of the video writes an MP4 with no streams; fail instead of uploading it.
    `ffprobe -v error -select_streams v -show_entries stream=codec_name -of csv=p=0 clip-${n}.mp4 | grep -q . || { echo "EMPTY_CLIP: nothing to render in this range"; exit 5; }`,
    `ffmpeg -y -v error -ss ${Math.min(1, dur / 2).toFixed(2)} -i clip-${n}.mp4 -frames:v 1 -vf scale=540:-2 -q:v 4 clip-${n}.jpg`,
    ...(linkUrl ? [`rm -f ${input}`] : []),
  ].join("\n");
}

/** Bash that waits up to `seconds` for `<phase>.done`. Exits 0 when it's there, 99 when still running. */
export function waitScript(phase: string, seconds: number): string[] {
  const tries = Math.max(1, Math.floor(seconds / 2));
  return ["-c", `cd ${WORKDIR} && for i in $(seq 1 ${tries}); do [ -f ${phase}.done ] && exit 0; sleep 2; done; exit 99`];
}
