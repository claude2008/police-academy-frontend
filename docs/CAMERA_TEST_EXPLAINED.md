# Camera Rep Counter ("العد الذكي") — How It Works

Scope: the push-up / sit-up camera counter at route `/fitness-counter`.
Unless stated otherwise, `page.tsx:N` refers to
`frontend/app/(main)/fitness-counter/page.tsx` (1,826 lines).

---

## 1. Files and components involved

| Path | Role |
|------|------|
| `frontend/app/(main)/fitness-counter/page.tsx` | The whole feature: a single client component `FitnessCounterPage` (`page.tsx:137`). Camera, pose loop, counting, overlay, settings, result screen, saved sessions. No sub-components or hooks live in separate files. |
| `frontend/components/ProtectedRoute` | Role gate wrapping the page; only `"owner"` is allowed (`page.tsx:1132-1136`). |
| `frontend/components/ui/button`, `frontend/components/ui/card` | shadcn UI primitives (`page.tsx:7-8`). |
| `frontend/app/(main)/dashboard/page.tsx:592-602` | Entry tile "العد الذكي" labelled "تجريبي" (experimental), shown only to `owner`, navigates to `/fitness-counter`. |
| `frontend/package.json:13-14` | Declares `@mediapipe/pose` and `@mediapipe/camera_utils`. **Neither is imported** by the page; the runtime uses CDN scripts instead (section 2). |
| `frontend/public/mediapipe/pose/*` | A partial local copy of `@mediapipe/pose` (`pose.js`, wasm loader JS, `pose_web.binarypb`, packed-assets loader). **Not referenced** by any code. It does not contain the `.wasm`, `.data` or `pose_landmark_*.tflite` files, so it could not serve the model as-is. |

There is no backend code for this feature (see section 8).

---

## 2. Libraries and model

| Item | Value | Reference |
|------|-------|-----------|
| Library | Legacy **MediaPipe Pose "Solutions" JS API** (`window.Pose`), not the newer `@mediapipe/tasks-vision` `PoseLandmarker`. | `page.tsx:619-621` |
| Pose version | `@mediapipe/pose@0.5.1675469404` | `page.tsx:427` |
| Drawing helpers | `@mediapipe/drawing_utils@0.3.1675466124` (`drawConnectors`, `drawLandmarks`, `POSE_CONNECTIONS`) | `page.tsx:428`, `page.tsx:652-663` |
| Load source | jsDelivr CDN, injected as `<script crossOrigin="anonymous">` on mount. Model/wasm assets are also fetched from the CDN via `locateFile`. | `page.tsx:409-437`, `page.tsx:621-624` |
| Model variant | `modelComplexity: 1` = **Full** BlazePose landmark model (0 = Lite, 2 = Heavy). | `page.tsx:630` |
| Other options | `smoothLandmarks: true`, `minDetectionConfidence: 0.5`, `minTrackingConfidence: 0.5`. `selfieMode` and `enableSegmentation` are not set (library defaults: off). | `page.tsx:629-634` |
| GPU / CPU | No delegate option exists in this API and none is set in code. The legacy solution runs its graph in WASM with WebGL-based image processing; there is no explicit CPU fallback path in the page. | `page.tsx:621-634` |
| Init guards | After the scripts load, a fixed 500 ms wait (`page.tsx:429`). `startPrepareCamera` polls for `window.Pose` up to 50 × 200 ms = 10 s (`page.tsx:758-760`). `pose.initialize()` is raced against a 10 s timeout (`page.tsx:625-628`). On failure: "فشل تحميل نموذج الذكاء الاصطناعي" (`page.tsx:724`, `page.tsx:764`, `page.tsx:767`). |

---

## 3. Camera setup

**Constraints** — `getVideoConstraints` (`page.tsx:125-135`):

| | Mobile (`window.innerWidth < 768`) | Desktop |
|---|---|---|
| width | `{ ideal: window.innerWidth }` | `640` (a bare number, which the browser treats as *ideal*) |
| height | `{ ideal: window.innerHeight * 0.7 }` | `480` |
| facingMode | from state | from state |
| frameRate | **not set** | **not set** |
| audio | `false` | `false` |

- **Facing mode** defaults to `'user'` (front camera) (`page.tsx:156`). A flip button toggles `user`/`environment`, restarts the stream, and restarts pose tracking if a camera stage is active (`page.tsx:778-810`, button `page.tsx:1320-1327`).
- **Fallback**: on any error except permission denial, it retries with `{ video: true }`, which drops the size and facing constraints (`page.tsx:439-455`).
- **Autoplay**: the video is set `playsinline`, `webkit-playsinline`, `muted` (`page.tsx:460-462`). If `play()` rejects, or `readyState` is still 0 after 3 s, a full-overlay "▶️ اضغط لتشغيل الكاميرا" (tap to start the camera) button appears (`page.tsx:466-477`, `page.tsx:1302-1319`).
- **FPS**: there is no camera FPS setting. Processing is a `requestAnimationFrame` loop that `await`s `pose.send({ image: video })` before scheduling the next frame, so throughput equals model speed and is capped by display refresh (`page.tsx:706-721`). The loop body is duplicated at `page.tsx:859-877` and `page.tsx:943-961` to restart it after stage changes. The processing rate is measured in `onResults` once per second (`page.tsx:636-643`) and shown as a badge, amber if below 15 (`page.tsx:1381-1391`).

**How the video is shown** (`page.tsx:1273-1410`):

- It is **not full screen**. It sits inside a `Card` on a normal page with `p-4 md:p-8` padding and a `max-w-3xl` column (`page.tsx:1137-1138`).
- The container is `relative w-full aspect-video md:w-[640px] md:h-[480px] md:mx-auto rounded-2xl` (`page.tsx:1275`). On mobile that is a full-width **16:9** box. From the `md` breakpoint up it is a fixed **640×480 (4:3)** box. This class string is the only place the layout is decided.
- `<video>` is absolutely positioned at `z-0`, `object-contain` (`page.tsx:1276-1289`).
- `<canvas>` is absolutely positioned on top at `z-10`, `object-contain`. It is rendered **only** in `waiting`/`countdown`/`active` (`page.tsx:1290-1296`). The canvas repaints the camera frame itself (`page.tsx:650`), so in those stages the user effectively sees the canvas, not the raw video.
- In the `prepare` stage there is no canvas. The user sees only the raw video, without a skeleton.
- With the front camera, both video and canvas are mirrored with CSS `transform: scaleX(-1)` (`page.tsx:374`). Landmark coordinates are **not** mirrored.
- On mobile, the requested stream is roughly portrait (window width × 70 % of height) but is displayed in a 16:9 box with `object-contain`, so it is letterboxed.

---

## 4. Pose pipeline

**Per-frame flow** — `pose.onResults` (`page.tsx:635-702`):

1. Update the FPS counter.
2. Set the canvas size to the video size (`page.tsx:647-648`), draw the frame, and draw the skeleton (section 7).
3. Route by stage:
   - `prepare`: set the body-ready flag and message.
   - `waiting`: auto-start after the body has been visible for 2 s.
   - `countdown`: abort back to `waiting` if the body is lost.
   - `active`: run `detectRep`.

**Side selection** — `getBestSide` (`page.tsx:95-101`): it sums the `visibility` of left landmarks 11/23/25/27 and right landmarks 12/24/26/28. It picks the right side if `right >= left`, otherwise the left. The choice is **re-evaluated every frame**.

| Side | shoulder | elbow | wrist | hip | knee | ankle |
|------|----------|-------|-------|-----|------|-------|
| Right | 12 | 14 | 16 | 24 | 26 | 28 |
| Left | 11 | 13 | 15 | 23 | 25 | 27 |

**Landmarks used per exercise**

- **Visibility gate (both exercises):** best-side shoulder, hip, knee and ankle must each have `visibility > 0.5`. This logic exists twice, as `isBodyVisibleForExercise` (`page.tsx:103-108`) and `evaluateBodyVisible` (`page.tsx:345-351`).
- **Push-up:**
  - Best-side shoulder, elbow and wrist give the elbow angle.
  - Best-side hip, knee and ankle give the knee angle.
  - Best-side shoulder, hip and knee give the hip angle.
  - The elbow and wrist are *not* visibility-checked (`page.tsx:490-500`, `page.tsx:117-123`).
- **Sit-up:**
  - Best-side hip, knee and ankle give the knee angle (`page.tsx:529`).
  - Best-side shoulder and hip, plus a synthetic point, give the torso angle (`page.tsx:573-574`).
  - Both shoulders (11, 12) give the shoulder width and the mid-shoulder point (`page.tsx:536`, `page.tsx:543-546`).
  - Both hips (23, 24) give the mid-hip point (`page.tsx:547-550`).
  - Both ears (7, 8) are hand anchors (`page.tsx:557`).
  - Both wrists (15, 16) must be near an anchor (`page.tsx:558`).
  - These both-side landmarks are used regardless of the chosen side and are not visibility-checked.

**Angle math**

- `calculateAngle` (`page.tsx:79-89`) and the identical `calcAngle` (`page.tsx:110-115`) compute the 2D angle at the middle point. They use the normalized `x`/`y` values directly: no aspect-ratio correction and no `z`.
- `distanceBetween` (`page.tsx:91-93`) is the Euclidean distance in normalized coordinates.

**Smoothing and filtering**

- The only temporal smoothing is MediaPipe's internal `smoothLandmarks: true` (`page.tsx:631`). There is no app-level moving average, EMA or hysteresis.
- **Jump filter:** if the exercise angle changes by more than **35°** from the last accepted value, the frame is skipped and `skippedJumps` is incremented (push-up `page.tsx:501-508`, sit-up `page.tsx:575-582`). `lastValidAngle` is updated only on accepted frames.
- **Tracking-loss counter** (diagnostic only): it is incremented when consecutive *recorded* rounded angles differ by more than 30° (`page.tsx:228-232`).
- `lastValidAngle` is reset at session start, finish, cancel and go-home (`page.tsx:845`, `page.tsx:834`, `page.tsx:971`, `page.tsx:993`).

**Confidence thresholds**

| Threshold | Value | Reference |
|-----------|-------|-----------|
| `minDetectionConfidence` | 0.5 | `page.tsx:632` |
| `minTrackingConfidence` | 0.5 | `page.tsx:633` |
| Per-landmark `visibility` | > 0.5 (shoulder, hip, knee, ankle) | `page.tsx:107`, `page.tsx:349` |

---

## 5. Counting logic per exercise

### 5.1 Session state machine (both exercises)

`type Stage = "select" | "prepare" | "waiting" | "countdown" | "active" | "result"` (`page.tsx:10`). The current stage is mirrored into `stageRef` for the pose callback (`page.tsx:139-144`).

1. **select:** choose an exercise (`selectExercise`, `page.tsx:983-988`).
2. **prepare:** a stage effect starts the camera and pose (`page.tsx:812-821`, `page.tsx:729-776`). The "استعداد" (Ready) button is enabled only when `mediapipeReady && previewReady` (`page.tsx:1434-1444`) and calls `enterWaiting` (`page.tsx:933-962`).
3. **waiting:** once the body has been continuously visible for **2,000 ms**, `beginCountdown` runs (`page.tsx:672-685`).
4. **countdown:** 5 → 1 with an 880 Hz beep each second, then a 440 Hz beep. Losing the body aborts back to `waiting` (`page.tsx:906-928`, `page.tsx:686-689`, `page.tsx:699-701`, `page.tsx:896-904`).
5. **active:** reps, phase, cooldown, jump filter and attempts are reset. Calibration recording is turned on and the **60 s** timer starts (`TEST_DURATION_SECONDS`, `page.tsx:23`; `page.tsx:839-894`). The last 5 seconds beep at 880 Hz and the end beeps at 330 Hz for 800 ms (`page.tsx:884-892`).
   - "⏹️ إيقاف" (Stop) ends the test early (`finishSession`).
   - "إلغاء" (Cancel) discards the test and returns to `prepare` (`page.tsx:964-981`, buttons `page.tsx:1392-1407`).
6. **result:** shows reps, elapsed seconds (`60 − timeLeft`, `page.tsx:829`) and the attempts table (`page.tsx:823-837`, `page.tsx:1777-1819`).

Inside `active`, every frame goes through `detectRep` (`page.tsx:480-600`). Any failed gate makes the frame `return` early. The rep phase is kept, the frame is ignored, and **the timer keeps running**.

### 5.2 Push-up (`page.tsx:490-523`)

Gates, applied in order:

1. Visibility gate (`page.tsx:481-485`). Fails with "⚠️ تأكد من ظهور الجسم كاملاً في الكاميرا" (make sure the whole body is visible).
2. Body straight, via `isBodyStraight` (`page.tsx:117-123`): knee angle (hip–knee–ankle) must be greater than `t.knee` **and** hip angle (shoulder–hip–knee) greater than `t.hip`. Fails with "⚠️ حافظ على استقامة الجسم — لا تضع الركبة على الأرض" (keep the body straight, do not put the knee on the ground).
3. Jump filter (more than 35°).

Counting angle: **elbow = angle(shoulder, elbow, wrist)** on the best side (`page.tsx:496-500`).

Thresholds — `PRESETS` (`page.tsx:53-57`):

| Preset | elbowDown | elbowUp | knee | hip | cooldownMs |
|--------|-----------|---------|------|-----|------------|
| easy | 110 | 150 | 130 | 120 | 500 |
| normal (default) | 100 | 155 | 145 | 135 | 650 |
| strict | 90 | 160 | 160 | 150 | 800 |

State machine (`phaseRef`: `null | "down" | "up"`, `page.tsx:362`):

- If `elbow < elbowDown`, the phase becomes `"down"`.
- If `elbow > elbowUp` **and** the phase is `"down"` **and** at least `cooldownMs` has passed since the last rep, then `reps += 1`, the phase becomes `"up"`, and the frame is marked `counted` (`page.tsx:510-520`).
- The phase starts as `null`, so the first rep must go down first.
- If the cooldown has not elapsed, the phase stays `"down"`. The rep is then counted on the next qualifying frame after the cooldown, so the cooldown **delays** a rep rather than rejecting it.

### 5.3 Sit-up (`page.tsx:524-599`)

Gates, applied in order:

1. Visibility gate (as above).
2. Knee must be bent: if angle(hip, knee, ankle) is greater than `t.kneeMax`, warn "⚠️ اثنِ الركبتين…" (bend the knees) (`page.tsx:528-533`).
3. Distance: if the shoulder width (distance from 11 to 12) is under 0.02 (normalized), warn "⚠️ اقترب من الكاميرا" (come closer to the camera) (`page.tsx:536-540`).
4. Hands position (`page.tsx:542-571`):
   - `chestCenter` is the mid-shoulder point moved 30 % of the way toward the mid-hip point.
   - The anchors are the ears (7, 8), the shoulders (11, 12) and `chestCenter`.
   - **Each** wrist (15, 16) must lie within `shoulderWidth × t.handRatio` of **some** anchor.
   - On failure the frame is ignored immediately. The warning "⚠️ ضع اليدين على الصدر أو خلف الرأس" (hands on the chest or behind the head) appears only after more than 8 consecutive failing frames (`handFailFrames`).
5. Jump filter (more than 35°).

Counting angle: **torso = angle(shoulder, hip, groundRef)**, where `groundRef = (hip.x, hip.y + 0.3)` is a point straight below the hip in image space (`page.tsx:573-574`). The result depends on where the shoulder sits relative to the hip in the image:

| Shoulder position relative to the hip | Torso angle |
|---------------------------------------|-------------|
| Same height (torso horizontal) | ≈ 90° |
| Directly above (torso vertical) | ≈ 180° |
| Lower than the hip | < 90° |

Thresholds — `SITUP_PRESETS` (`page.tsx:59-63`):

| Preset | up | down | kneeMax | handRatio | cooldownMs |
|--------|----|------|---------|-----------|------------|
| easy | 85 | 130 | 165 | 1.4 | 450 |
| normal (default) | 75 | 140 | 155 | 1.1 | 600 |
| strict | 65 | 150 | 145 | 0.9 | 750 |

State machine (`page.tsx:585-595`):

- If `torso > t.down`, the phase becomes `"down"`.
- If `torso < t.up` **and** the phase is `"down"` **and** the cooldown has elapsed, `reps += 1` and the phase becomes `"up"`.
- In other words, a rep is counted when the torso goes from **near-vertical** (above `down`) to an angle **below `up`**, which is less than 90°. That means the shoulder must be lower than the hip in the image. See section 9, item 1.

### 5.4 Rejected attempts and the attempts log

`recordCalibAngle` (`page.tsx:226-286`) runs on every accepted frame when `calibRef.current || stage === "active"` (`page.tsx:521-523`, `page.tsx:596-598`). Because `active` alone satisfies the condition, it **always runs during a test**. It tracks the running minimum and maximum angle and appends every rounded angle to `calibData`.

**Counted frame** (`page.tsx:240-266`):

- It pushes `{ bottom: min, top: max, counted: true, at: ms since start }`.
- If the previous entry is a rejection whose `bottom` is within 3° and is at most 1,500 ms old, that rejection is **replaced** by the counted entry, so a rejected entry is not also logged for the same movement.
- It then resets the minimum, maximum and reject trackers.

**Rejected-attempt detection** (`page.tsx:268-285`):

- The threshold is `elbowUp` for push-ups. For sit-ups it is a **hard-coded 150°** (`getRejectAscentThreshold`, `page.tsx:204-208`).
- When the angle drops below the threshold, tracking is armed and the minimum is recorded.
- When the angle rises back above the threshold while armed, and the minimum reached at least 25° below the threshold, it pushes `{ bottom: min, top: null, counted: false }`.
- Rejected attempts are **informational only** and do not change the rep count.

The log is capped at 100 entries (`pushAttempt`, `page.tsx:197-202`).

**Summary of how invalid reps are kept out of the count:**

- **Frame-level gates:** visibility, body straight (push-up), and knee and hands (sit-up).
- **Jump filter:** frames that change by more than 35° are dropped.
- **Full range required:** the state machine needs the full down→up threshold crossing, so partial range never counts.
- **Cooldown:** a minimum time between reps.
- **Partial reps:** these are only *logged* as "مرفوض" (rejected).

---

## 6. Settings and calibration

**Strictness panel (push-up)** — shown only in the `prepare` stage (`page.tsx:1449-1576`):

- Four buttons: "🟢 متساهل" (easy), "🟡 متوسط" (normal), "🔴 صارم" (strict), "⚙️ مخصص" (custom), each captioned `elbowDown° / elbowUp°` (`page.tsx:1452-1475`).
- Picking a preset copies `PRESETS[key]` into `thresholds` (`page.tsx:170-172`). A ref mirrors the value into the pose callback (`page.tsx:168`).
- **Custom** shows five sliders:

  | Slider | Range | Step | Constraint | Reference |
  |--------|-------|------|------------|-----------|
  | elbowDown | 70–130 | 5 | capped at `elbowUp − 20` | `page.tsx:1478-1499` |
  | elbowUp | 130–175 | 5 | at least `elbowDown + 20` | `page.tsx:1500-1521` |
  | knee | 110–170 | 5 | — | `page.tsx:1522-1538` |
  | hip | 100–170 | 5 | — | `page.tsx:1539-1555` |
  | cooldownMs | 300–1000 | 50 | — | `page.tsx:1556-1572` |

**Strictness panel (sit-up)** (`page.tsx:1577-1694`):

- The same four buttons, captioned `الصعود < up°` (up < N°) (`page.tsx:1580-1603`). The preset is applied via the effect at `page.tsx:299-302`.
- **Custom** sliders: up 55–95 (`page.tsx:1606-1622`), down 120–165 (`page.tsx:1623-1639`), kneeMax 130–175 (`page.tsx:1640-1656`), handRatio 0.6–2.0 in 0.1 steps (`page.tsx:1657-1673`), cooldownMs 300–1000 (`page.tsx:1674-1690`).
- There are **no** cross-constraints between `up` and `down`.

**Persistence:** none. Strictness state resets to `"normal"` on every page load (`page.tsx:164-165`, `page.tsx:174-175`).

**Not configurable:** the 60 s test duration (`page.tsx:23`), the 5 s countdown, the 2 s auto-start hold, the 0.5 confidence and visibility thresholds, the 35° jump filter, and the 150° sit-up reject threshold.

**Calibration ("📊 تسجيل الزوايا", angle recording)** — a toggle shown during `active` (`page.tsx:1717-1732`):

- Automatically switched on at test start (`page.tsx:849`).
- Switching it **on** calls `resetCalibSession()` (`page.tsx:1720-1723`), which clears `attempts.current`, `calibData`, the counters and the min/max trackers (`page.tsx:210-224`).
- Switching it **off** only hides the panel. Recording continues while `active` (see 5.4).
- Panel contents (`page.tsx:1733-1770`): counted and rejected totals, FPS, a "📋 نسخ" (Copy) button that copies the pipe-separated attempts summary (`buildCalibSummary`, `page.tsx:288-297`), the live attempts table, and the skipped-frame and tracking-loss counts.

There is no camera calibration (no lens, distance or angle calibration), and no per-user or age-based thresholds.

**Static tips** on the exercise cards (`page.tsx:72-77`): film from the side at 90°, use good lighting, stand 2–3 m from the camera, and keep the camera still.

---

## 7. On-screen overlay

**Drawn on the canvas** (`page.tsx:644-665`). The canvas exists only in waiting, countdown and active:

| Element | Details | Reference |
|---------|---------|-----------|
| Camera frame | `drawImage(results.image)` | `page.tsx:650` |
| Skeleton lines | `drawConnectors(..., POSE_CONNECTIONS, { color: "#00FF00", lineWidth: 2 })`, covering all 33 landmarks including the face | `page.tsx:654-659` |
| Landmark points | `drawLandmarks(..., { color: "#FF0000", lineWidth: 1 })` | `page.tsx:660-663` |

No angle numbers, threshold lines, phase indicator or highlighting of the joints used for counting are drawn on the canvas.

**HTML overlays on top of the video box:**

| Element | Stage | Reference |
|---------|-------|-----------|
| "جاري تشغيل الكاميرا..." (camera starting) | prepare, before video ready | `page.tsx:1297-1301` |
| "▶️ اضغط لتشغيل الكاميرا" (tap to start the camera) | autoplay blocked | `page.tsx:1302-1319` |
| Flip-camera button (top-right) | all camera stages | `page.tsx:1320-1327` |
| Dim overlay "في انتظار ظهور الجسم في الكاميرا" (waiting for the body to appear), plus the warning text | waiting | `page.tsx:1328-1339` |
| Large countdown number | countdown | `page.tsx:1340-1346` |
| Timer badge (black; amber at 10 s or less; red at 5 s or less) | active | `page.tsx:1349-1369` |
| Reps badge "N تكرار" (N reps) | active | `page.tsx:1370-1372` |
| Strictness label badge | active | `page.tsx:1374-1380` |
| FPS badge "معدل المعالجة" (processing rate; amber below 15) | active | `page.tsx:1381-1391` |
| Stop and Cancel buttons | active | `page.tsx:1392-1407` |

**Below the video box:**

- **prepare:**
  - Camera error text (`page.tsx:1414-1416`).
  - "⏳ جاري تحميل نموذج العد..." (loading the counting model) (`page.tsx:1417-1421`).
  - Body-ready message: green for "✅ الوضع مثالي" (position is ideal), pulsing amber otherwise (`page.tsx:1422-1432`).
- **waiting / countdown:** error text and a Back button (`page.tsx:1697-1705`).
- **active:**
  - A pulsing red warning box (`page.tsx:1708-1712`) showing the latest `setWarning` text: body not visible, body not straight, bend the knees, come closer, or hand position.
  - The calibration panel (section 6).

**Audio feedback:** WebAudio sine beeps (`playBeep`, `page.tsx:323-336`). There is **no** sound or visual pulse when a rep is counted; only the badge number changes.

---

## 8. How the result is saved and instructor review

- **Result screen** (`page.tsx:1777-1819`): exercise, reps, elapsed seconds, and the attempts table (`renderAttemptsTable`, `page.tsx:1086-1127`, with columns #, bottom angle, top angle, ✅/❌, seconds).
- **Save** ("💾 حفظ") calls `saveCurrentSession` (`page.tsx:1033-1047`):
  - It builds `{ id: Date.now(), exercise, reps, durationSec, savedAt, attempts }`.
  - It prepends that to **`localStorage["smart-counter-sessions"]`** (`page.tsx:24`, `page.tsx:48-51`).
  - The button disables after one save (`page.tsx:1801-1807`).
- **No backend involvement:**
  - The page makes no `fetch`/API calls.
  - No soldier, trainee, course or instructor identity is attached to a session.
  - Nothing links to fitness records or exam entries.
  - The page header itself says "حفظ الجلسات محلياً على هذا الجهاز" (sessions are saved locally on this device) (`page.tsx:1142`).
- **Saved sessions list** (on the select screen, `page.tsx:1196-1264`): sessions are loaded on mount (`page.tsx:304-306`, `page.tsx:26-47`). Each row can be expanded to show its attempts table. The list supports:
  - Deleting one session (`page.tsx:1049-1054`).
  - Deleting all sessions after a `window.confirm` (`page.tsx:1056-1061`).
  - "📋 تصدير الكل" (Export all), which copies every session as plain text to the clipboard (`page.tsx:1063-1084`).
- **Review and edit:** the instructor (only role `owner` can open the page) can **view** reps and the per-attempt angles. There is **no** way to edit or override the rep count, accept or reject individual attempts, add notes, or mark a result as reviewed. After a test the only choices are save, "استعداد للمتدرب التالي" (get ready for the next trainee; resets and goes straight to `waiting`, `page.tsx:1010-1031`) or go home.

---

## 9. Known weaknesses and limitations

1. **The sit-up angle direction looks inverted for floor sit-ups.**
   - The torso angle is about 90° lying flat and about 180° sitting upright (5.3).
   - A rep needs the angle above `down` (130–150°, nearly upright) and then below `up` (65–85°, shoulders *lower* than hips in the image) (`page.tsx:585-587`).
   - On a flat floor with a level camera, lying flat gives about 90°, which never drops below the normal (75) or strict (65) `up` threshold. That would only happen on a decline bench or with a tilted camera.
   - The comment at `page.tsx:528` ("machine keeps legs bent") suggests the logic was tuned for a bench or machine.
2. **The side-view advice conflicts with the sit-up hand check.**
   - The tips say to film from the side (`page.tsx:73`).
   - In a side view the two shoulders overlap, so `shoulderWidth` (11↔12) becomes very small.
   - That shrinks the hand tolerance (`shoulderWidth × handRatio`) and can trigger the under-0.02 "come closer" gate (`page.tsx:536-540`, `page.tsx:556`).
3. **Sit-ups use landmarks from both sides without visibility checks** (ears, both shoulders, both hips, both wrists). In a side view the far-side points are guesses.
4. **Push-ups do not visibility-check the elbow or wrist**, the joints that drive the count (`page.tsx:496-500`).
5. **The best side is re-picked every frame** (`page.tsx:95-101`). It can switch sides mid-rep, causing an angle jump that the jump filter then drops.
6. **Angles are computed in normalized 2D image coordinates** with no aspect-ratio correction and no depth. On 4:3 or 16:9 frames, oblique angles are distorted, and any camera position other than a side view changes the measured angles.
7. **The jump filter can lock out** (`page.tsx:501-508`, `page.tsx:575-582`). `lastValidAngle` is not updated on skipped frames, so a real fast movement (more than 35° between processed frames, which is likely at low FPS) causes every following frame to be skipped until the angle comes back near the stale value.
8. **There is no app-level smoothing or hysteresis.** One noisy frame crossing `elbowDown`, or the sit-up `down` threshold, is enough to arm the phase.
9. **The timer never pauses.** When the body leaves the frame or a form gate fails, frames are silently ignored while the 60 s timer keeps running (`page.tsx:880-893`).
10. **The cooldown delays a rep instead of rejecting it** (5.2). A fast bounce still counts once the cooldown expires, if the angle is still past `elbowUp`.
11. **The calibration toggle can wipe the attempt log mid-test.** Turning it off and on calls `resetCalibSession()` and clears `attempts.current` while `reps` is kept, so the saved attempts table no longer matches the rep count (`page.tsx:1720-1723`, `page.tsx:210-224`). Turning it off does not stop recording.
12. **The sit-up reject threshold is hard-coded at 150°** and ignores the selected preset (`page.tsx:206`).
13. **The page depends on the CDN at runtime.** The scripts, wasm and model all come from jsDelivr (`page.tsx:427-428`, `page.tsx:623`), so the page needs internet access and is not covered by PWA offline caching. The local `public/mediapipe/pose` copy is unused and incomplete. The declared npm packages `@mediapipe/pose` and `@mediapipe/camera_utils` are unused.
14. **It uses a legacy API.** The `@mediapipe/pose` Solutions API is the older one; the current API is `tasks-vision` `PoseLandmarker`. There is no GPU/CPU delegate control.
15. **Camera constraints are loose.**
    - There is no `frameRate` constraint.
    - The `{ video: true }` fallback silently drops `facingMode` (`page.tsx:446-447`).
    - Mobile requests a portrait-ish size but displays it in a 16:9 box, so it is letterboxed (`page.tsx:128-130`, `page.tsx:1275`).
16. **The video is not full screen.** On phones the 16:9 box inside a padded card leaves a small video, which works against the 2–3 m distance advice.
17. **There is per-frame React state churn.**
    - `setWarning` runs every frame.
    - `setCalibData` appends every angle (about 1,800 or more entries per test; it is only used for a length check, `page.tsx:236`, `page.tsx:1733`).
    - The canvas `width`/`height` are reassigned every frame (`page.tsx:647-648`), which reallocates the canvas.
18. **Logic is duplicated.** The angle function, the visibility check and the pose loop body each exist more than once (`page.tsx:79` / `page.tsx:110`, `page.tsx:103` / `page.tsx:345`, `page.tsx:706` / `page.tsx:861` / `page.tsx:945`).
19. **Init timing is fragile.** It relies on a fixed 500 ms delay after the scripts load, 10 s polling and a 10 s init timeout (`page.tsx:429`, `page.tsx:758-760`, `page.tsx:625-628`).
20. **Results are local only.**
    - They are tied to one device and browser and can be lost when browser storage is cleared.
    - They carry no trainee identity, no instructor sign-off and no audit trail.
    - The rep count cannot be edited or overridden.
    - Access is owner-only and the dashboard marks the page as experimental (`page.tsx:1132-1136`, `dashboard/page.tsx:592-602`).
21. **Fixed protocol:** a 60 s test, a 5 s countdown and a 2 s auto-start hold, none of which can be configured.
22. **No feedback when a rep is counted** (no beep, flash or haptic), and no live angle readout on screen.
