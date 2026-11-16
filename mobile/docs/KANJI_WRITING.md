# Kanji handwriting — mobile

## Source audit and wire contract

Audited `frontend/src/pages/Kanji.jsx`, `components/kanji/KanjiCanvas.jsx`, `KanjiStrokeOrder.jsx`, web API definitions, backend `app/api/kanji.py`, `models/schemas.py`, recognition/dictionary/KanjiVG services, and `ml/kanji_recognizer.py`. No web/backend source changes.

- Web capture canvas: 720×720 logical pixels. Pointer positions scale from the rendered rectangle. Each stroke is an ordered array; the outer array preserves stroke order.
- Point: `{x, y, timestamp, pressure, strokeId}`. Timestamp is milliseconds since epoch; pressure falls back to 0.5; strokeId is `${timestamp}-${strokeNumber}`. Backend also accepts optional `time` but web does not send it.
- Bounds span **all** strokes. Width/height are at least 1. `scale = 256 * (1 - 2 * 0.13) / max(width,height)`. Each axis is centered: `x' = (x-minX)*scale + (256-width*scale)/2`, likewise y. This preserves aspect ratio and reserves 13% padding. A single dot follows the same minimum-width/height behavior as web.
- POST `/kanji/recognize`: `{image_data, strokes, target_kanji, jlpt_level}`. `image_data` is `data:image/png;base64,...`, white background, dark smooth strokes, normalized 256×256, no guides/reference. Web thresholds raster pixels at gray <210 to black, else white. Default pen width is 18 pixels in the recognition image as well as the logical canvas; pressure factor `0.82 + averagePressure*0.36`.
- Web and backend schema impose **no maximum point count**. Mobile normalizes using all captured points, then uniformly samples at most **256 points per stroke**, preserving endpoints/order/metadata; image uses all captured points. Capture suppresses movements <1 logical pixel and caps each individual captured stroke at 4,096 points. This is an explicit mobile performance policy, not an invented web limit. Finger pressure stays 0.5 for consistent Android/iPhone input.
- Mobile PNG is deterministic binary grayscale, using the same midpoint quadratic geometry/round pen. Software disk rasterization replaces browser antialiasing plus thresholding: boundary pixels can differ slightly; do not claim byte-identical images. PNG dimensions, background, geometry, coordinate system and payload schema match. PNG uses uncompressed DEFLATE (~88 KB base64) to avoid another dependency/native snapshot and asynchronous capture races.
- Response: `{success,predictions,engine,isDemo,sample_id,message,low_confidence}`. Predictions contain `kanji`, confidence in **0..1**, meaning, onyomi/kunyomi, stroke count, JLPT, optional radical/structure/reasons. Backend reranks CNN candidates with stroke-count metadata, returns up to five. The CNN predictor currently ignores `jlpt_level` and stroke geometry; the service uses stroke count for reranking. Sending a JLPT hint does not constrain candidates to that level. Confidence is a score, not measured accuracy.

## Endpoints and actual coverage

| API | Meaning / mobile usage |
| --- | --- |
| GET `/kanji/model-info` | Actual model availability, supported_jlpt and exact supported_kanji; read dynamically, never inferred from dictionary levels. |
| GET `/kanji/supported` | Available vector guides; does **not** imply recognition support. Used to select the next practice character. |
| GET `/kanji/{character}/strokes` | Web guide paths, `viewBox`, `stroke_count`, metadata, source/license. Read during audit; mobile reuses existing `/stroke-order` adapter/animation. |
| GET `/kanji/{character}/metadata` | Web practice metadata/count/readings; mobile existing detail and stroke-order responses already supply these fields. |
| GET `/kanji/{character}/stroke-order` | Existing mobile vector guide and reusable stroke-order animation. |
| GET `/kanji/{character}/handwriting-samples?limit=3` | Reference ETL handwriting thumbnails; empty response is normal and does not determine model coverage. |
| POST `/kanji/correction` | `{image_data,strokes,predicted_kanji,correct_kanji,jlpt_level}`; returns `{success,sample_id}`. Optional correction UI deferred in this delivery; no corrections sent. A future UI must ask explicit consent. |

Live read-only checks on 2026-11-14 returned HTTP 200: model available, **245 labels**, **N5 and N4**; vector guides **6,703 entries**, including non-kanji entries. Next practice therefore uses the intersection of model labels and vector guides. Do not assume all N5/N4 characters are trained. N3 dictionary browsing remains separate from model coverage.

Ordinary recognition also saves images/strokes through `kanji_sample_store` on the server. The screen explains this before submission. Cancellation prevents stale UI updates and aborts transport, but cannot undo an inference/sample save the server already started. Client never automatically retries POST; request ownership prevents double taps.

## Implemented / limits

Kanji list → recognition; character details → writing practice. Single finger, quadratic smoothing, square grid, undo/clear, parent scroll lock while drawing, themed rendering, faint SVG guides and existing animation, reference handwriting images, top candidates with confidence and detail links. Recognition is manual (no timer/background submissions). Practice compares the first recognized candidate with the target and reports actual/expected stroke count. Unsupported targets can be traced but cannot be submitted for grading. Missing guides explicitly show unavailable status. New ink/undo/clear, screen blur/unmount abort pending requests; timeout is 20 seconds. Draft ink is screen-local.

Web practice uses local count/shape/proportion/smoothness heuristics, with special handling for 月; it does not use a backend per-stroke grading API. Mobile intentionally provides simpler count + model feedback and does not reproduce those heuristic scores or claim precise stroke-order assessment. User-stroke replay and correction submission are deferred; reference stroke animation is available. There is no new backend requirement for this scope. Accurate per-stroke grading would require further algorithm/API work.

`react-native-svg` installed by `npx expo install`; bundled in Expo Go. PanResponder is React Native core; no custom native module. Existing Expo 58 / React Native 0.88.1 baseline retained. Both platforms use the same logical coordinates/PNG implementation. Expo Go must support the project's SDK. Existing custom development builds need rebuilding if they do not contain SVG.

Palm rejection is limited: only a single touch starts drawing; secondary touches are ignored while present and do not create extra strokes. React Native touch events do not reliably distinguish a palm from a finger across devices; this is not full hardware palm rejection. No stylus pressure promise. Existing strokes cache their SVG paths; active stroke previews schedule at most one update per animation frame. Actual frame rate and finger-tracking on midrange devices remain unmeasured.

## Validation and device checklist

Automated checks: mobile typecheck/lint/i18n, complete existing tests plus eight handwriting tests, frontend translation check, and Android/iOS production JS/asset export. Unit tests execute the actual unchanged web normalization functions over empty/tap/horizontal/vertical/multiple-stroke fixtures, verify ordering/metadata/decimation/endpoints, quadratic geometry and PNG decode/dimensions/binary pixels. Export is **not** an installed APK/IPA or physical-device test.

**Recognition accuracy observed:** no real-device handwriting session or representative evaluation set was available; no accuracy percentage is claimed. GET availability/label counts do not establish accuracy. Synthetic geometry tests establish payload correctness only. Outside-label ink can map to an unrelated supported label, even at high confidence; the recognition screen explicitly warns about this. Model confidence and correct stroke count do not prove correct stroke order.

Run every row on **both Android and iPhone in Expo Go**; all currently require manual execution:

| Check | Android | iPhone |
| --- | --- | --- |
| Open Kanji → recognize; draw 一/二/三 and a complex supported character slowly/quickly; inspect candidate/detail/readings/animation | ☐ | ☐ |
| Many strokes and one long continuous stroke; verify smooth lines, taps, endpoints, frame rate, no unintended joins | ☐ | ☐ |
| Undo several strokes, clear; recognize empty (disabled); no old result after new ink | ☐ | ☐ |
| Draw while page can scroll: finger stays on canvas, page locks; release restores scrolling outside canvas; second finger/palm does not add a stroke | ☐ | ☐ |
| Rotate before/during drawing and pending recognition; square/coordinates retained, no stale result; small screen/safe areas | ☐ | ☐ |
| Recognize a known supported label, then outside-label ink; warning present and candidate is never presented as guaranteed | ☐ | ☐ |
| Practice supported target correctly/wrongly; count feedback, alternate candidates/detail, retry and next target; animation and handwriting samples | ☐ | ☐ |
| Practice an unsupported target and one without guides: clear notice, no misleading model grading | ☐ | ☐ |
| Airplane mode, server timeout/error, rapid repeated taps; retry explicitly; draw again/back out during request | ☐ | ☐ |
| Switch vi/en and every theme in light/dark; long labels/readability; export image remains white/black | ☐ | ☐ |

Android-specific: three-button/gesture navigation, system back, parent ScrollView arbitration. iPhone-specific: notch/home indicator, native swipe-back during inference, multi-touch cancellation. Native recognizer arbitration, palm behavior, real-device performance, orientation and model accuracy can only be confirmed with the actual device/backend together.
