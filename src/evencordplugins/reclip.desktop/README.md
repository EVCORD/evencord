# Reclip

Keep the moment. Formerly bossclip; existing settings migrate automatically. EvenCord maintains the source in `src/evencordplugins/reclip.desktop` and existing recordings stay in their original folders.

A local Windows replay recorder for EvenCord. Capture the main Discord window, audible call audio, and your microphone, then save recent footage with a button or global shortcut. No game or Discord screen share is required.

## Controls

- Enable **Reclip** in EvenCord settings. Searching for bossclip also finds it.
- Click the replay arrow beside your user controls to start the buffer, or press **Ctrl+Alt+F9**.
- A red center means recording; an amber center means starting or saving. Click the recording button or press **Ctrl+Alt+F10** to save a clip. Recording continues.
- Right click the replay button to save, stop, open clips, or reveal the last saved clip. Controls are also in plugin settings and Toolbox.
- Disable **Show replay button** to hide the icon. The keyboard shortcuts, settings controls, and Toolbox remain available.
- The settings panel shows available duration, the target duration, actual output dimensions, frame-rate limit, microphone, and encoded buffer size.
- Clips are saved under your Windows **Videos\Reclip** folder. Choose WebM, MP4, or MKV in **Save format**.
- Enable **Auto Start** only if you want the buffer to begin whenever Discord starts. Otherwise, recording starts manually.
- Shortcut changes apply after disabling and enabling the plugin. A shortcut already used by another program produces a warning; buttons remain available.

## Recording behavior

Video is restricted to the main Discord web content. Separate popout windows, the desktop, and other applications are not captured. A small startup window briefly obtains capture access and then hides. The recorder uses its own sandboxed process and session, without replacing Discord's screen share handler.

Audio is Windows loopback plus a separate microphone input. Other applications using the same output can be audible. Discord must play through the Windows default output device. This does not isolate individual callers or capture unheard audio when Discord is deafened.

The microphone defaults to **Windows default microphone**, so recording does not require selecting a device first. On the first start after this update, the previous automatic Follow Discord selection is migrated to Windows default; specific device selections, communications default, and Microphone off are preserved. The selector lists available Discord inputs automatically. You can explicitly choose Follow Discord if desired. The selected input is resolved when recording starts; device changes require stopping and starting Reclip. Windows and Discord device identifiers differ, so specific inputs are matched by their device names. Ambiguous or missing matches produce an error instead of silently choosing another microphone.

Microphone and speaker recording have separate volume controls. Speaker capture and microphone processing can be disabled. Turning both audio sources off creates a video-only recording and avoids creating an audio mixer. Microphone capture is independent of Discord mute and push to talk; select **Microphone off** to exclude it.

## Clip length and quality

The default clip length is **2 minutes**. Choose **5 minutes**, **10 minutes**, or a custom length from **1 to 30 minutes**. The custom minutes field appears only with Custom duration; custom quality fields appear only with Custom quality. The previous ten-minute value is changed to two minutes once when upgrading; other durations are preserved and ten minutes can be selected again. The buffer must already be running before the moment you want to save. Early clips contain only the footage available, and saves start at a usable video keyframe, so they can be slightly shorter than the target.

| Preset | Maximum resolution | Maximum frame rate | Target video bitrate |
| --- | --- | --- | --- |
| Light | 720p | 15 fps | 1.5 Mbps |
| Balanced, default | 1080p | 20 fps | 3 Mbps |
| High | 1080p | 30 fps | 5 Mbps |
| Smooth | 1080p | 60 fps | 8 Mbps |
| Custom | 720p or 1080p | 15, 20, 30, or 60 fps | 1 to 8 Mbps |

60 fps is an upper limit and depends on source frames, the encoder, and your machine. Balanced remains the default for lower resource use. Smooth can use more CPU, GPU, and memory.

The recorder preserves Discord's aspect ratio and does not enlarge a smaller captured source. Output dimensions remain fixed for that recording when the window is resized. A larger Discord window can provide sharper source detail.

Save settings, then stop and start the buffer to apply duration, quality, or audio changes. Stopping discards unsaved footage. Notification preferences apply immediately; shortcut changes require disabling and enabling the plugin.

## Save formats

| Format | Behavior | Requirement |
| --- | --- | --- |
| WebM, default | Saves the original VP8/VP9 video and Opus audio directly | No external software |
| MP4 | Converts to H.264 video and AAC audio, with fast-start metadata | FFmpeg with libx264 and AAC, detected automatically or selected in settings |
| MKV | Writes Matroska with the original streams and a seek index | No external converter |

Save format applies to the next save without restarting the buffer. FFmpeg is optional and is never downloaded or installed by the plugin. It runs hidden, without a command shell, only when converting a saved clip. MP4 conversion uses a two-thread video encoder and takes extra CPU and time; it is not a total CPU limit. MKV saves directly without re-encoding. The frozen buffer snapshot is released before conversion so it does not remain pinned in memory throughout a long export.

For MP4, the WebM is saved first. MP4 is finalized only after conversion succeeds; then that newly created intermediate WebM is removed. If conversion fails, is cancelled, or exceeds twenty minutes, the original WebM is retained and a warning is shown. Disabling the plugin cancels its active converter. No earlier saved recording is deleted. Choose ffmpeg.exe in settings if automatic discovery cannot find a newly installed tool; no relaunch is needed. Recording continues during export, but only one save can run at a time.

## Resource controls

The encoded buffer limit is selectable: **128, 256, or 512 MiB**, with 256 MiB as the default. If the limit is reached, old footage is discarded at a keyframe and the panel reports the shortened duration. The selected duration and bitrate are also checked against the limit to show an estimate before recording. This is not a total process RAM limit: frames, audio, metadata, and snapshots during saves consume additional memory, and the encoder has a bounded allowance while waiting for the next keyframe.

Efficient capture is enabled by default. It skips canvas redraws when the video reports no new frame, retaining a one-second refresh for timing and keyframes. It falls back to normal redraws when the frame counter is unavailable or zero. Frame rate is capped, stopped recordings do not poll the native capture process, and saves are streamed in small pieces rather than assembling a second full video in Discord's renderer. Choose Light for the smallest workload. Actual CPU and GPU use depends on the machine and content and has not been benchmarked.

Clips have fresh WebM container metadata and rebased audio/video timestamps. Files are written in small pieces to a unique partial file and renamed only after writing completes. There is no automatic upload or retention cleanup. Stopping the plugin, reloading, or quitting Discord discards unsaved footage.

## Limits

Windows and an Electron build supporting display capture are required. Capture or microphone failures are reported rather than silently producing a microphone-only or silent clip. Device changes during recording may require stopping and starting the buffer. Minimized, suspended, or locked sessions can freeze video; a continuously changing recording while Discord is minimized is not guaranteed. Saved WebM files need a player supporting VP8/VP9 and Opus.

The EvenCord integration was compiled and type checked. Recording, voice and format conversion still need manual validation after a separately approved installation.

## Upstream status

This is an official EvenCord distribution plugin adapted from the local Equicord implementation, not an accepted upstream Vencord plugin. Its user-controls button relies on Equicord's UserArea API, which is absent from the upstream Vencord source reviewed for this update. An upstream version needs a supported button integration, real author attribution, a full compatibility review, and human validation before submission. The author list remains empty pending the maintainer's public identity.

Read [Vencord's contribution rules](https://github.com/Vendicated/Vencord/blob/main/CONTRIBUTING.md) and [plugin setup documentation](https://docs.vencord.dev/plugins/). Vencord requires disclosure of AI assistance and a human who fully understands the submitted code. Discuss the recorder and optional FFmpeg requirement with maintainers before preparing a submission. No pull request or issue has been created.

### Save folder

Use **Choose folder** in Reclip settings to open the Windows folder picker. The default is `Videos/Reclip`; **Use default folder** restores it. The choice applies to future clips and persists in EvenCord plugin settings. Existing clips are not moved. A disconnected or inaccessible folder produces an error instead of silently redirecting the recording.

### Export compatibility

New WebM and MKV files contain a seek head, duration and keyframe index. Both save without an external converter. MP4 requires FFmpeg with H.264/AAC support. Reclip checks PATH, standard Windows locations and WinGet packages, and the settings page lets you choose ffmpeg.exe directly without restarting Discord. The converter path is saved in native settings for this Discord channel and excluded from plugin-settings imports. On conversion failure the original WebM is preserved. Old recordings are not automatically rewritten.
