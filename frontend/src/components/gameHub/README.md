# Game Hub

`GameHubContent` renders the page content inside the existing app layout. Sidebar and Topbar are owned by `Layout`, which this redesign leaves intact.

- `HeroBanner`: emerald/seigaiha banner, existing SenpaiAI cat asset, featured game CTA.
- `FilterBar`: controlled category and search state, horizontally scrollable category pills on narrow screens.
- `GameCard`: pastel skill illustration, local record, progress and modal entry. Real links preserve keyboard access and opening in another tab.
- `LevelSelectModal`: N5–N1 selection, data eligibility, focus trap/restore, Escape and backdrop dismissal, body scroll lock.
- `GameGuide`: goal, three steps and a tip for each card, translated through shared `gameGuides.<id>` keys. Cards and the game frame both expose help; opening help during a round pauses it.

Add an entry to `src/features/gameHub/catalog.ts` (`GAMES_DATA`) to extend the grid. Study shortcuts retain the existing Quiz and Flashcard activities; all nine shared minigames remain. Listening is available only in its dedicated practice section, not in this hub. Set `engine` when connecting to a shared-engine game so eligibility, high scores and completed levels are derived from actual data. Add new display strings to both vi/en `common.json`. Search matches localized names/descriptions and accepts unaccented Vietnamese.

Displayed coin amounts are explicitly labeled design previews and never call a wallet API. Progress counts completed supported JLPT levels from local minigame statistics; it does not invent stage unlocks. Ranked has an empty state until a real ranked mode exists. Grammar practice is available only from its dedicated study section; the racing showcase card has been removed.

Only shared-engine games open the hub JLPT picker and use `?level=N3` (validated by `readLevel`). Quiz and Flashcard shortcuts navigate directly without a redundant level dialog or query parameter. Shared minigame setup checks eligibility before accepting the selected level.

Validation: frontend lint/build, `node --test tests/*.test.mjs`, web/mobile locale checks. Browser review covers searching, category filtering, locked levels, modal close, JLPT navigation and horizontal overflow at 320/390/1440 px, plus dark mode. Screenshots under the workspace `tmp/` folder are review artifacts, not application assets. Reduced-motion styling disables decorative animation and transitions.

Kanji Arena is removed. Kanji Study and quick quizzes are in `/kanji?mode=study`; the old `/games/kanji` route redirects there. The hub now has 11 cards.
