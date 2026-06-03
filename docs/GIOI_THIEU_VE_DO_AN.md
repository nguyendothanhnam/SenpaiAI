# GIOI THIEU VE DO AN: HineGoldAI - Japanese Learning Assistant

Tai lieu nay duoc tong hop tu ma nguon hien co cua du an. Cac mo ta ben duoi chi dua tren logic dang co trong repo, khong mo rong sang chuc nang chua duoc cai dat.

## 1. Gioi thieu de tai

HineGoldAI la ung dung web ho tro nguoi Viet hoc tieng Nhat theo dinh huong JLPT. He thong ket hop giao dien React, backend FastAPI, co so du lieu PostgreSQL, tim kiem ngu nghia bang ChromaDB, LLM cuc bo qua Ollama va mo hinh CNN nhan dang chu Kanji viet tay.

Muc tieu chinh cua de tai:

- Ho tro hoi dap tieng Nhat, giai thich tu vung, ngu phap, kanji va van hoa bang tieng Viet.
- Luu tru, quan ly va tim kiem tai lieu hoc tap theo loai tai lieu va trinh do JLPT.
- Phan tich ngu phap, dich Nhat - Viet, du doan muc do JLPT.
- Cung cap cong cu hoc Kanji: tra cuu, quiz, stroke order, canvas viet tay, nhan dang bang CNN.
- Cung cap cac minigame, quiz va flashcard de on tap.
- Quan ly tai khoan, lich su chat va mot phan tien do hoc tap.

Ten ung dung trong backend la `HineGoldAI - Japanese Learning Assistant` o `backend/app/main.py`. Mot so thong diep goc con dung ten `SenpaiAI`; khi bao ve co the trinh bay day la ten cu trong metadata/bao cao, con chuc nang hien tai la cung mot ung dung hoc tieng Nhat.

## 2. Phan tich thiet ke he thong

### 2.1 Yeu cau chuc nang

#### Dang ky, dang nhap, quan ly tai khoan

Ma nguon: `backend/app/api/auth.py`, `backend/app/core/auth.py`, `frontend/src/services/auth.tsx`, `frontend/src/pages/Login.tsx`, `frontend/src/pages/Profile.tsx`.

- Mo ta: Nguoi dung dang ky bang email, username va mat khau; dang nhap de nhan JWT; cap nhat username, JLPT level va learning goals; xuat du lieu hoc tap; reset tien do; xoa tai khoan.
- Input: email, username, password; JWT Bearer token; thong tin cap nhat profile.
- Output: thong tin user, access token, export data, thong bao thanh cong/loi.
- Luong xu ly:
  1. Frontend goi `/auth/register` hoac `/auth/login`.
  2. Backend kiem tra trung email/username, hash mat khau bang bcrypt.
  3. Khi login dung, backend tao JWT voi claim `sub=email`.
  4. Frontend luu `access_token` vao `localStorage` va gan header Authorization.
  5. Cac API can bao ve lay user hien tai qua `get_current_active_user`.

#### Chat AI va lich su hoi dap

Ma nguon: `backend/app/api/chat.py`, `backend/app/services/chat_prompt.py`, `backend/app/services/llm_service.py`, `backend/app/services/ollama_service.py`, `backend/app/services/vector_db.py`, `frontend/src/pages/Chat.tsx`.

- Mo ta: Nguoi dung hoi ve tieng Nhat; he thong phan loai y dinh trong prompt, uu tien mot so cau tra loi xac dinh, co the truy van Library de bo sung ngu canh RAG, goi LLM va luu lich su.
- Input: message, context tuy chon, jlpt_level.
- Output: answer, jlpt_level, grammar_points, translation, sources, response_time.
- Luong xu ly:
  1. Frontend gui `POST /chat/message`.
  2. Backend kiem tra cac truong hop deterministic nhu cau trac nghiem co `学生`, cau hoi luyen hoi thoai, phan tich cau mau.
  3. Neu nguoi dung hoi ve mot Kanji don, backend tra tu tu dien Kanji cuc bo.
  4. Neu la multiple-choice vocabulary, backend thu tra loi bang `vocab_mcq_service`.
  5. Neu khong phai cac truong hop tren, backend goi `chroma_service.get_relevant_context`.
  6. Backend goi `japanese_service.chat_response`, mac dinh qua Ollama.
  7. Ket qua va sources duoc luu vao bang `chat_history`.
  8. Frontend hien thi lich su theo `created_at` tang dan va tu dong scroll xuong cuoi.

#### Phan tich ngu phap va dich

Ma nguon: `backend/app/api/analysis.py`, `backend/app/services/grammar_analyzer.py`, `backend/app/services/llm_service.py`, `backend/app/services/ollama_service.py`, `frontend/src/pages/Grammar.tsx`.

- Mo ta: Phan tich cau tieng Nhat thanh cac muc Sentence meaning, Vocabulary, Grammar patterns, JLPT level, Difficulty score, Learning suggestions. Co tuy chon dich sang tieng Viet.
- Input: `text`, `include_translation`.
- Output: jlpt_level, sentence_meaning, vocabulary, grammar_patterns, grammar_points, translation, difficulty_score, suggestions.
- Luong xu ly:
  1. Frontend gui `POST /analysis/grammar`.
  2. Backend goi LLM qua `japanese_service.analyze_grammar`.
  3. Ket qua duoc chuan hoa bang `sanitize_grammar_analysis`.
  4. Cac tu N5 pho bien nhu `がくせい / 学生`, `意味`, mau `どういう意味` duoc xu ly bang rule an toan.
  5. Difficulty map theo JLPT: N5 khoang 2.5, N4 4.0, N3 5.5, N2 7.5, N1 9.5.

#### Learning Library

Ma nguon: `backend/app/api/library.py`, `backend/app/services/library_service.py`, `backend/app/services/vector_db.py`, `frontend/src/pages/Library.tsx`, `frontend/src/services/api.ts`.

- Mo ta: Quan ly tai lieu hoc tap, CRUD tai lieu, fetch noi dung tu URL, thong ke, categories, semantic search bang ChromaDB.
- Input: title, content, document_type, jlpt_level, tags, source_url; query search; filter document_type/jlpt_level.
- Output: danh sach document, document detail, relevance_score, stats, categories.
- Luong xu ly:
  1. Frontend tai stats tu `/library/stats`.
  2. Frontend tai categories tu `/library/categories`.
  3. Danh sach tai lieu dung `GET /library/documents`.
  4. Them tai lieu dung `POST /library/documents`; backend validate title/content/document_type.
  5. Backend luu PostgreSQL truoc, sau do chunk va index vao ChromaDB.
  6. Tim kiem dung `POST /library/search`; backend tim semantic trong ChromaDB va fallback keyword neu khong co ket qua vector.
  7. Sua tai lieu dung `PUT /library/documents/{id}` va refresh chunks.
  8. Xoa tai lieu dung `DELETE /library/documents/{id}` va xoa chunks ChromaDB.

#### Kanji Canvas va nhan dang viet tay

Ma nguon: `frontend/src/pages/Kanji.jsx`, `frontend/src/components/kanji/KanjiCanvas.jsx`, `backend/app/api/kanji.py`, `backend/app/services/kanji_recognition_service.py`, `backend/ml/kanji_recognizer.py`, `backend/ml/kanji_model.py`.

- Mo ta: Nguoi dung viet Kanji tren canvas, he thong chuyen net ve anh PNG 256x256, gui backend nhan dang bang CNN, ket hop rerank bang so net, JLPT va tan suat.
- Input: image_data base64, strokes, target_kanji, jlpt_level.
- Output: predictions gom kanji, confidence, meaning, onyomi, kunyomi, stroke_count, jlpt, reasons.
- Luong xu ly:
  1. Canvas ghi lai strokes bang pointer events.
  2. `KanjiCanvas` normalize strokes vao khung 256 va tao PNG nen trang net den.
  3. Frontend gui `POST /kanji/recognize`.
  4. Backend goi `predict_kanji` trong `backend/ml/kanji_recognizer.py`.
  5. CNN tra top-k theo softmax.
  6. `kanji_recognition_service` tinh diem cuoi: 70% CNN confidence, 15% stroke count, 10% JLPT, 5% frequency.
  7. Neu confidence thap, frontend cho phep nguoi dung chon Kanji dung va gui correction.
  8. Correction duoc luu vao `backend/ml/user_samples`.

#### Kanji hoc tap, stroke order, tra cuu va minigame

Ma nguon: `backend/app/api/kanji.py`, `backend/app/services/kanji_dictionary_service.py`, `backend/app/services/kanjivg_service.py`, `frontend/src/pages/Kanji.jsx`, `frontend/src/pages/KanjiMinigame.jsx`, `frontend/src/data/kanjiDataset.ts`.

- Mo ta: Tra cuu Kanji theo JLPT, tim kiem theo chu/nghia/reading, xem stroke order tu KanjiVG, hoc flash-like, quiz reading/meaning, Kanji Matching Game.
- Input: jlpt, search, mode, count, Kanji key.
- Output: danh sach Kanji, detail, stroke order, quiz items, matching grid pairs.
- Luong xu ly:
  1. API `/kanji/list` doc tu tu dien cuc bo.
  2. API `/kanji/{kanji}/stroke-order` doc SVG KanjiVG neu co, fallback JSON normalized.
  3. Frontend mode `explore`, `practice`, `stroke`, `recognize` trong `Kanji.jsx`.
  4. `KanjiMinigame.jsx` gop data tu backend dictionary, Library va built-in dataset.
  5. Kanji Matching Game chi ghep Kanji voi nghia tieng Viet, co Correct/Wrong/Accuracy/Streak/Reset.

#### Quiz upload va quiz play

Ma nguon: `backend/app/api/game.py`, `frontend/src/pages/QuizUpload.jsx`, `frontend/src/pages/QuizPlay.jsx`, `frontend/src/utils/storage.js`, `frontend/src/utils/quizAnswers.js`.

- Mo ta: Tao quiz thu cong, upload Excel/JSON, luu quiz set vao `localStorage`, loc saved quiz sets, choi quiz voi dap an A/B/C/D hoac full text.
- Input: file Excel/JSON; columns `question`, `option_a`, `option_b`, `option_c`, `option_d`, `correct_answer`, `explanation`, `jlpt_level`, `category`.
- Output: quiz set, cau hoi, diem, ket qua dung/sai.
- Luong xu ly:
  1. Excel upload goi `/game/quiz/upload`, backend doc bang pandas.
  2. Backend chuan hoa header khong phan biet hoa thuong va cach viet.
  3. Frontend chuan hoa lai cau hoi va luu quiz set vao `dacs_quiz_sets`.
  4. Khi choi, click option A/B/C/D thi luu selected la letter.
  5. `isCorrectQuizAnswer` so sanh ca letter va full option text.
  6. Xoa saved quiz set chi xoa quiz set local, khong xoa history.

#### Flashcard learning management

Ma nguon: `frontend/src/pages/Flashcard.jsx`, `frontend/src/pages/FlashcardPlay.jsx`, `frontend/src/pages/FlashcardManual.jsx`, `frontend/src/utils/storage.js`, `backend/app/api/game.py`.

- Mo ta: Quan ly flashcard theo set, import Excel/CSV/JSON, tao set thu cong, duplicate, edit, delete, hoc tung set rieng va luu thong ke moi set.
- Input: flashcard front/back, jlpt_level, category, file import.
- Output: flashcard sets, cards, stats correct/wrong/streak/accuracy.
- Luong xu ly:
  1. Trang Flashcard doc `dacs_flashcard_sets` tu localStorage.
  2. Import goi `/game/flashcard/import`, backend doc CSV/JSON/Excel bang pandas.
  3. Frontend luu set voi metadata source, file_name, jlpt_level, category.
  4. Study page chi tai cards cua set dang chon.
  5. Khi danh dau Correct/Wrong, frontend cap nhat stats cua set.
  6. Xoa mot card khong xoa stats; xoa set thi bo ca set va stats cua set do.

### 2.2 Yeu cau phi chuc nang

- Bao mat: JWT Bearer token, mat khau hash bcrypt, route nguoi dung can `get_current_active_user`.
- Kha nang mo rong API: route Library va mot so route Kanji ho tro ca prefix `/library/...` va `/api/library/...`.
- Kha nang phuc hoi loi: Library co fallback stats/search; ChromaDB indexing loi thi tai lieu van duoc luu va tra `indexing_warning`.
- Hieu nang tim kiem: document content duoc chunk bang `RecursiveCharacterTextSplitter` kich thuoc 500, overlap 50; semantic search dung ChromaDB PersistentClient.
- UX: React Query cache, loading states, toast notifications, responsive grid, modal CRUD.
- Van hanh: `docker-compose.yml` dinh nghia Ollama, PostgreSQL, backend, frontend, Redis tuy chon; backend co `/health`.

### 2.3 Kien truc tong the

```text
Nguoi dung
  -> Frontend React/Vite
  -> FastAPI Backend
  -> PostgreSQL: users, chat_history, learning_sessions, documents, grammar_rules, kanji, vocabulary
  -> ChromaDB: chunks cua documents
  -> Ollama: LLM chat/grammar/translation/JLPT
  -> PyTorch CNN: Kanji handwriting recognition
  -> JSON data: kanji_dictionary.json, kanjivg_strokes.json, KanjiVG SVG
```

Frontend dung `frontend/src/services/api.ts` va `api.js` de goi API voi base URL mac dinh `http://localhost:8000/api`. Backend trong `backend/app/main.py` include routers ca khong prefix va co prefix `/api` cho nhieu nhom endpoint.

### 2.4 Luong tong quat

- Luong auth: Login/Register -> JWT -> luu token -> goi API co Authorization.
- Luong chat/RAG: Message -> deterministic checks -> Kanji/vocab rules -> ChromaDB context -> Ollama -> save ChatHistory -> render.
- Luong Library: Form tai lieu -> PostgreSQL -> ChromaDB chunks -> stats/search/cards/modal.
- Luong Kanji Canvas: strokes -> image PNG -> CNN -> rerank -> predictions -> correction sample.
- Luong Quiz/Flashcard: upload/manual -> normalize -> localStorage set -> play/study -> stats.

## 3. Giai thich source code

### 3.1 Backend

#### `backend/app/main.py`

- Vai tro: Khoi tao FastAPI, CORS, TrustedHost, include routers, startup database tables, validate Kanji dictionary va model info.
- Input: HTTP requests tu frontend.
- Output: API JSON, OpenAPI docs, health check.
- Diem bao ve: `Base.metadata.create_all(bind=engine)` tao bang neu chua co; production van nen dung Alembic migrations.

#### `backend/app/core/config.py`

- Vai tro: Cau hinh database_url, secret_key, JWT algorithm, Ollama, ChromaDB, CORS.
- Gia tri mac dinh: database PostgreSQL local, LLM provider `ollama`, model `gemma:2b`, Chroma persist `./chroma_db`.

#### `backend/app/core/auth.py`

- Vai tro: hash/verify password, tao/verify JWT, lay current user.
- Logic chinh: bcrypt qua `passlib`, JWT HS256 qua `python-jose`, token doc tu `HTTPBearer`.

#### `backend/app/models/database.py`

- Vai tro: SQLAlchemy ORM models.
- Cac bang chinh: `users`, `chat_history`, `learning_sessions`, `documents`, `grammar_rules`, `kanji`, `kanji_readings`, `kanji_examples`, `vocabulary`, `vocabulary_kanji`.
- Luu y: `documents` chi co cac field on dinh `id, title, content, document_type, jlpt_level, tags, source_url, created_at, updated_at, embedding_id, chunk_index`; khong co `description`.

#### `backend/app/models/schemas.py`

- Vai tro: Pydantic request/response schemas.
- Cac nhom schema: User/Token, Chat, Grammar, Translation, Document/Library, Kanji/Vocabulary, KanjiRecognition, LearningSession.

#### `backend/app/api/auth.py`

- Vai tro: Register, login, get/update profile, export data, reset progress, delete user.
- Quan he DB: User co chat_history va learning_sessions.

#### `backend/app/api/chat.py`

- Vai tro: Chat endpoint, history, search, delete.
- Logic dang chu y:
  - `deterministic_chat_answer` xu ly mot so cau mau de dam bao chat dung tieng Viet va dung intent.
  - `find_single_kanji_request` uu tien tra tu dien Kanji cuc bo.
  - `vocab_mcq_service.try_answer` xu ly multiple-choice vocabulary.
  - RAG dung `chroma_service.get_relevant_context`.
  - History duoc order theo `created_at.asc()`.

#### `backend/app/api/analysis.py`

- Vai tro: Grammar analysis, translate, predict JLPT.
- Logic: Goi `japanese_service`, sau do sanitize ket qua grammar bang `sanitize_grammar_analysis`.

#### `backend/app/api/library.py`

- Vai tro: CRUD tai lieu, fetch URL, semantic search, categories, stats, quiz pairs.
- Dac diem: Cung mot endpoint duoc khai bao cho `router` prefix `/library` va `api_router` prefix `/api/library`.

#### `backend/app/services/library_service.py`

- Vai tro: Business logic cho Library.
- Logic chinh:
  - Validate title/content/document_type/JLPT.
  - Normalize tags.
  - Luu PostgreSQL truoc, index ChromaDB sau.
  - Search semantic, fallback keyword.
  - Preview dung 150 ky tu dau tu content.
  - Fetch URL bang requests + BeautifulSoup, loai script/style/nav/footer/noisy selector.

#### `backend/app/services/vector_db.py`

- Vai tro: ChromaDB wrapper.
- Logic chinh:
  - PersistentClient theo `settings.chroma_persist_directory`.
  - Collection `japanese_learning`.
  - Chunk size 500, overlap 50.
  - Metadata moi chunk gom document_id, title, document_type, jlpt_level, tags, source_url, chunk_index, total_chunks.
  - Similarity score = `1 - distance`.

#### `backend/app/services/llm_service.py` va `ollama_service.py`

- Vai tro: Lop trung gian goi LLM. Neu provider la Ollama thi dung `ollama_service`, nguoc lai co fallback OpenAI.
- Ollama:
  - Model tu config, mac dinh `gemma:2b`.
  - `_call_ollama` thu `ollama.chat`, fallback `ollama.generate`.
  - Co check ket noi va message huong dan khi Ollama/model chua san sang.

#### `backend/app/services/chat_prompt.py`

- Vai tro: System prompt cho HineGoldAI.
- Noi dung chinh: phan loai intent, tieng Viet la ngon ngu giai thich chinh, khong tra loi chi bang tieng Nhat, format rieng cho quiz/conversation/vocab/grammar/translation/kanji/sentence analysis.

#### `backend/app/services/grammar_analyzer.py`

- Vai tro: Lop an toan sau LLM.
- Logic chinh:
  - Co deterministic grammar analysis cho cau `「がくせい」はどういう意味ですか。`.
  - Them common vocab N5/N4 neu text chua tu pho bien.
  - Loc suggestion khong lien quan nhu articles/prepositions/conjunctions.
  - Khong bien vocabulary thanh grammar pattern.

#### `backend/app/api/kanji.py`

- Vai tro: API cho tu dien Kanji, quiz, matching grid, recognition, correction, model info, KanjiVG strokes, vocabulary CRUD.
- Dac diem: Co mot so route khai bao ca `/api/kanji/...` va `/kanji/...`.

#### `backend/app/services/kanji_dictionary_service.py`

- Vai tro: Doc `backend/app/data/kanji_dictionary.json`, filter JLPT/search, tao quiz/matching grid, tra handwriting samples tu ETL10 processed.
- Luu y: validate dictionary kiem tra meaning/readings/strokes/jlpt.

#### `backend/app/services/kanjivg_service.py`

- Vai tro: Doc stroke order tu KanjiVG SVG hoac `kanjivg_strokes.json`.
- Output: strokes path SVG, stroke_count, source/license/source_url.

#### `backend/app/services/kanji_recognition_service.py`

- Vai tro: Nhan request recognition, goi ML prediction, rerank ket qua, luu sample.
- Cong thuc rerank: 0.70 CNN confidence + 0.15 stroke count + 0.10 JLPT + 0.05 frequency.

#### `backend/ml/kanji_model.py`

- Vai tro: Dinh nghia CNN.
- Kien truc:
  - Input grayscale 1 channel.
  - Conv2d 1->32 + BatchNorm + ReLU + MaxPool.
  - Conv2d 32->64 + BatchNorm + ReLU + MaxPool.
  - Conv2d 64->128 + BatchNorm + ReLU + MaxPool.
  - Conv2d 128->256 + BatchNorm + ReLU + AdaptiveAvgPool 4x4.
  - Flatten -> Dropout 0.35 -> Linear 4096->512 -> ReLU -> Dropout 0.25 -> Linear 512->num_classes.

#### `backend/ml/kanji_recognizer.py`

- Vai tro: Load `kanji_model.pt`, `label_map.json`, preprocess image, predict top-k.
- Preprocess:
  - Decode base64 PNG.
  - Grayscale, autocontrast.
  - Tim ink mask voi pixel < 245.
  - Crop bounding box net ve, thumbnail vao 64x64 tru padding.
  - Nen trang, dao nguoc pixel thanh tensor net = 1.0.

#### `backend/ml/train_kanji_model.py`

- Vai tro: Train CNN.
- Dataset:
  - ETL10 processed folder.
  - Dataset folder tuy chon.
  - Synthetic dataset render bang font tieng Nhat.
  - User samples tu correction/recognition.
- Training:
  - Split train/validation, val size max so label hoac 15%.
  - WeightedRandomSampler de uu tien sample co trong so.
  - Loss CrossEntropy, optimizer AdamW.
  - Luu best model theo validation accuracy vao `models/kanji_model.pt`, luu label map.

#### `backend/ml/scripts/prepare_etl10_dataset.py`

- Vai tro: Chuan bi ETL10/ETL-CDB thanh folder `etl10_processed/<kanji>/*.png`, resize/crop ve 64 hoac 128 va ghi `label_map.json`.

#### `backend/app/api/game.py`

- Vai tro: Quiz/flashcard API.
- Quiz upload:
  - Doc Excel bang pandas.
  - Normalize header ve `question`, `option_a-d`, `correct_answer`, `explanation`, `jlpt_level`, `category`.
  - Validate row: missing question, missing options, invalid correct answer.
- Flashcard import:
  - Ho tro CSV, JSON, Excel.
  - Normalize front/back/jlpt/category.
- Luu y: Backend game_service hien dung in-memory `USER_QUIZ`, `USER_FLASHCARD`; frontend moi la noi luu quiz/flashcard sets bang localStorage.

### 3.2 Frontend

#### `frontend/src/App.tsx`

- Vai tro: Dinh nghia route va bao ve route theo auth.
- Neu chua dang nhap: chi cho `/login`.
- Neu da dang nhap: route `/chat`, `/grammar`, `/library`, `/games`, `/games/kanji`, `/quiz`, `/flashcard`, `/kanji`, `/profile`, `/analytics`.

#### `frontend/src/services/api.ts` va `api.js`

- Vai tro: Axios client, gan token, handle 401, khai bao API wrappers.
- `api.ts` dung cho TypeScript pages; `api.js` dung cho JSX pages.

#### `frontend/src/services/auth.tsx`

- Vai tro: AuthContext.
- Logic: Doc token tu localStorage, fetch `/auth/me`, login/register/logout, cap nhat user state.

#### `frontend/src/pages/Chat.tsx`

- Vai tro: Chat UI.
- Logic:
  - React Query tai history.
  - Sort message theo `created_at` tang dan.
  - Search chi filter khi query active.
  - `bottomRef.scrollIntoView` sau khi messages update.
  - Co modal handwriting input de chen Kanji vao chat.

#### `frontend/src/pages/Grammar.tsx`

- Vai tro: Form phan tich ngu phap va hien thi ket qua theo section.
- Cac section: JLPT Level, Sentence Meaning, Vocabulary, Grammar Patterns, Learning Suggestions.

#### `frontend/src/pages/Library.tsx`

- Vai tro: Learning Library UI.
- Logic:
  - Dashboard 4 stat cards.
  - Search form: query, type, JLPT, sort.
  - Document grid cards co preview content 150 ky tu, tags, source URL, relevance.
  - Add/Edit modal validate required fields.
  - Detail modal xem full content.
  - Delete confirmation modal.
  - Toast notifications cho save/search/delete/indexing warning.

#### `frontend/src/pages/Kanji.jsx`

- Vai tro: Kanji Canvas lab.
- Modes: recognize, practice, stroke, explore.
- Logic:
  - Explore doc dictionary backend.
  - Recognize gui image/strokes toi backend.
  - Practice tinh feedback dua tren stroke count, shape, centering, size, axis strokes.
  - Stroke mode tai KanjiVG va cho step/auto play.
  - Ask in Chat prefill cau hoi ve Kanji.

#### `frontend/src/components/kanji/KanjiCanvas.jsx`

- Vai tro: Canvas viet tay.
- Logic:
  - Bat pointer strokes, pressure, strokeId.
  - Normalize strokes ve square 256.
  - Tao anh PNG recognition 256x256.
  - Cung cap imperative methods: isEmpty, getStrokes, getRawStrokes, getImage, clear.
  - Ho tro replay, undo, clear, recognize/check.

#### `frontend/src/pages/KanjiMinigame.jsx`

- Vai tro: JLPT Kanji Learning va Kanji Matching Game.
- Logic:
  - Gop source: backend dictionary, Library extracted Kanji, built-in dataset.
  - Mode study, quiz, search, vocabulary.
  - Vocabulary mode hien Kanji Matching Game, khong co hidden/flip card, chi ghep Kanji voi Vietnamese meaning.

#### `frontend/src/pages/QuizUpload.jsx`

- Vai tro: Upload Excel/JSON va save quiz set.
- Logic:
  - JSON parse client-side.
  - Excel goi backend upload.
  - Normalize question/options/correct_answer.
  - Save vao localStorage qua `saveQuizSet`.

#### `frontend/src/pages/QuizPlay.jsx`

- Vai tro: Hien saved quiz sets va choi quiz.
- Logic:
  - Filter by JLPT/category/file name.
  - Play/Delete saved set.
  - Khi chon option, luu letter A/B/C/D.
  - Validate answer qua `isCorrectQuizAnswer`.

#### `frontend/src/utils/quizAnswers.js`

- Vai tro: Chuan hoa va so sanh dap an quiz.
- Logic:
  - `normalizeAnswer`: trim, uppercase, bo `.` va `)`.
  - Chap nhan correct_answer la letter, full text, hoac dang `A. text`.
  - Neu user tra letter ma correct la full text thi tim text option tu letter.

#### `frontend/src/pages/Flashcard.jsx` va `FlashcardPlay.jsx`

- Vai tro: Quan ly va hoc flashcard sets.
- Logic:
  - Home hien total sets, total cards, recently studied, aggregate accuracy.
  - Filter set by JLPT/category/source va search.
  - Study/Edit/Duplicate/Delete.
  - Play page chi load card cua selected set, co dropdown doi set, flip card, Correct/Wrong, cap nhat stats.

#### `frontend/src/utils/storage.js`

- Vai tro: Local storage layer cho quiz/flashcard.
- Keys: `dacs_quiz_list`, `dacs_quiz_sets`, `dacs_flashcard_list`, `dacs_flashcard_sets`.
- Logic: migrate legacy list sang set, infer metadata, CRUD sets, record flashcard study result.

## 4. Thiet ke co so du lieu

Nguon: `backend/app/models/database.py`, `backend/alembic/versions/0001_initial_migration.py`, `backend/alembic/versions/0002_kanji_vocabulary_api.py`.

### `users`

| Cot | Kieu | Y nghia |
| --- | --- | --- |
| id | Integer PK | Dinh danh user |
| email | String unique | Email dang nhap |
| username | String unique | Ten hien thi |
| hashed_password | String | Mat khau da hash |
| is_active | Boolean | Trang thai tai khoan |
| created_at | DateTime | Ngay tao |
| updated_at | DateTime | Ngay cap nhat |
| current_jlpt_level | String | JLPT hien tai |
| learning_goals | JSON | Muc tieu hoc |

Quan he: 1 user co nhieu `chat_history`, nhieu `learning_sessions`.

### `chat_history`

| Cot | Kieu | Y nghia |
| --- | --- | --- |
| id | Integer PK | Dinh danh message |
| user_id | FK users.id | Chu so huu |
| question | Text | Cau hoi nguoi dung |
| answer | Text | Cau tra loi |
| jlpt_level | String | JLPT cua cau tra loi/ngu canh |
| grammar_points | JSON | Diem ngu phap trich xuat |
| translation | Text | Ban dich neu co |
| sources | JSON | Nguon RAG/dictionary |
| created_at | DateTime | Thoi diem tao |

### `learning_sessions`

| Cot | Kieu | Y nghia |
| --- | --- | --- |
| id | Integer PK | Dinh danh phien hoc |
| user_id | FK users.id | Chu so huu |
| session_type | String | Loai phien: chat, grammar, translation, quiz |
| topic | String | Chu de |
| difficulty_level | String | Muc do |
| duration_minutes | Integer | Thoi luong |
| questions_answered | Integer | So cau da lam |
| correct_answers | Integer | So cau dung |
| created_at | DateTime | Ngay tao |
| completed_at | DateTime | Ngay hoan thanh |

### `documents`

| Cot | Kieu | Y nghia |
| --- | --- | --- |
| id | Integer PK | Dinh danh tai lieu |
| title | String | Tieu de |
| content | Text | Noi dung day du |
| document_type | String | vocabulary, grammar, lesson, culture, example |
| jlpt_level | String nullable | N5-N1 |
| tags | JSON | Danh sach tag |
| source_url | String nullable | URL nguon |
| created_at | DateTime | Ngay tao |
| updated_at | DateTime | Ngay cap nhat |
| embedding_id | String nullable | ID chunk dau tien trong ChromaDB |
| chunk_index | Integer | Index chunk |

Khong co cot `description`. Preview tai lieu duoc tao tu `content.substring(0, 150)` o frontend va `_preview` o backend.

### `grammar_rules`

| Cot | Kieu | Y nghia |
| --- | --- | --- |
| id | Integer PK | Dinh danh rule |
| rule_name | String | Ten rule |
| japanese_pattern | String | Mau ngu phap |
| meaning | Text | Y nghia |
| usage_notes | Text | Ghi chu cach dung |
| examples | JSON | Vi du |
| jlpt_level | String | JLPT |
| difficulty_score | Float | Do kho |
| created_at | DateTime | Ngay tao |

### `kanji`

| Cot | Kieu | Y nghia |
| --- | --- | --- |
| id | Integer PK | Dinh danh Kanji |
| character | String(1) unique | Ky tu Kanji |
| meaning_vi | Text | Nghia tieng Viet |
| jlpt_level | String(2) | N5-N1 |
| stroke_count | Integer | So net |
| created_at | DateTime | Ngay tao |
| updated_at | DateTime | Ngay cap nhat |

Rang buoc: character chi 1 ky tu, jlpt_level thuoc N5-N1.

### `kanji_readings`

| Cot | Kieu | Y nghia |
| --- | --- | --- |
| id | Integer PK | Dinh danh reading |
| kanji_id | FK kanji.id | Kanji cha |
| reading_type | String | onyomi hoac kunyomi |
| reading | String | Cach doc |
| romaji | String | Romaji |
| created_at | DateTime | Ngay tao |

Quan he: bi xoa cascade khi xoa Kanji.

### `kanji_examples`

| Cot | Kieu | Y nghia |
| --- | --- | --- |
| id | Integer PK | Dinh danh vi du |
| kanji_id | FK kanji.id | Kanji cha |
| sentence | Text | Cau vi du |
| reading | Text | Cach doc |
| romaji | Text | Romaji |
| meaning_vi | Text | Nghia tieng Viet |
| created_at | DateTime | Ngay tao |

### `vocabulary`

| Cot | Kieu | Y nghia |
| --- | --- | --- |
| id | Integer PK | Dinh danh tu |
| japanese_word | String | Tu tieng Nhat |
| reading | String | Cach doc |
| romaji | String | Romaji |
| meaning | Text | Nghia |
| part_of_speech | String | Tu loai |
| jlpt_level | String | N5-N1 |
| example_sentences | JSON | Vi du |
| created_at | DateTime | Ngay tao |
| updated_at | DateTime | Ngay cap nhat |

Rang buoc unique: `(japanese_word, reading)`.

### `vocabulary_kanji`

| Cot | Kieu | Y nghia |
| --- | --- | --- |
| id | Integer PK | Dinh danh lien ket |
| vocabulary_id | FK vocabulary.id | Tu vung |
| kanji_id | FK kanji.id | Kanji trong tu |
| position_in_word | Integer | Vi tri Kanji trong tu |

Quan he: vocabulary xoa cascade link; kanji xoa restrict neu con link.

## 5. Thuat toan va cong nghe

### 5.1 Semantic Search va RAG

Nguon: `backend/app/services/vector_db.py`, `backend/app/services/library_service.py`, `backend/app/api/chat.py`.

- Khi them/sua document, Library Service goi ChromaDB add_documents.
- Noi dung duoc chia chunk 500 ky tu, overlap 50.
- Moi chunk co metadata document_id, title, document_type, jlpt_level, tags, source_url.
- Search Library goi `collection.query(query_texts=[query], where=filter_dict)`.
- Diem lien quan la `1 - distance`, duoc clamp/round khi tra ve.
- Neu semantic search khong co document_id hop le, backend fallback keyword search tren title/content bang `ilike`.
- Trong chat, backend lay 3 context lien quan theo JLPT user, ghep thanh prompt cho LLM.

### 5.2 Ollama va LLM

Nguon: `backend/app/services/ollama_service.py`, `backend/app/services/llm_service.py`, `backend/app/services/chat_prompt.py`, `backend/app/core/config.py`.

- Provider mac dinh la Ollama.
- Model mac dinh: `gemma:2b`.
- Docker-compose co buoc pull `gemma:2b` va `nomic-embed-text`.
- Service goi `ollama.chat`; neu loi thu fallback `ollama.generate`.
- Prompt chat yeu cau phan loai intent va giai thich bang tieng Viet.
- Grammar/translation/JLPT co prompt rieng.
- Neu Ollama khong chay, service tra loi loi ro rang cho nguoi dung.

### 5.3 Kanji Recognition CNN

Nguon: `backend/ml/kanji_model.py`, `backend/ml/kanji_recognizer.py`, `backend/ml/train_kanji_model.py`, `backend/ml/scripts/prepare_etl10_dataset.py`, `backend/app/services/kanji_recognition_service.py`.

#### Dataset va label

- Label lay tu `backend/ml/kanji_labels.py`, uu tien `backend/app/data/kanji_dictionary.json` neu co.
- Ho tro JLPT N5-N4 cho recognition labels.
- Du lieu co the den tu:
  - ETL10 processed: `backend/ml/data/etl10_processed/<kanji>/*.png`.
  - Folder dataset tuy chon.
  - Synthetic images sinh tu font tieng Nhat.
  - User correction samples trong `backend/ml/user_samples`.

#### Preprocessing train/inference

- Chuyen grayscale.
- Tim bounding box net, crop va center vao square.
- Resize ve 64x64 hoac 128x128 khi train; inference mac dinh 64.
- Nen trang, net den.
- Normalize pixel ve [0,1], dao nguoc de net co gia tri cao.

#### CNN layers

CNN gom 4 block convolution:

1. Conv2d 1->32, BatchNorm, ReLU, MaxPool.
2. Conv2d 32->64, BatchNorm, ReLU, MaxPool.
3. Conv2d 64->128, BatchNorm, ReLU, MaxPool.
4. Conv2d 128->256, BatchNorm, ReLU, AdaptiveAvgPool 4x4.

Classifier:

- Flatten.
- Dropout 0.35.
- Linear 256*4*4 -> 512.
- ReLU.
- Dropout 0.25.
- Linear 512 -> num_classes.

#### Training

- Data split train/val bang `random_split`.
- Validation size = max(so label, 15% tong sample), nhung khong vuot qua tong sample - 1.
- Dung WeightedRandomSampler theo sample_weights.
- Loss: CrossEntropyLoss.
- Optimizer: AdamW, lr mac dinh 1e-3, weight_decay 1e-4.
- Moi epoch in train_loss, train_acc, val_loss, val_acc.
- Neu val_acc >= best_acc, luu `kanji_model.pt` va `label_map.json`.

#### Inference va rerank

- `kanji_recognizer.py` load model va label map.
- Neu thieu file, model unavailable va tra message yeu cau train/add files.
- Predict top-k bang softmax.
- `kanji_recognition_service.py` rerank bang:
  - 70% CNN confidence.
  - 15% stroke_count_score.
  - 10% JLPT score.
  - 5% frequency score.
- Neu confidence < 0.65, tra low confidence va yeu cau nguoi dung correct de cai thien mo hinh.

### 5.4 KanjiVG Stroke Order

Nguon: `backend/app/services/kanjivg_service.py`, `frontend/src/components/kanji/KanjiStrokeOrder.jsx`, `frontend/src/pages/Kanji.jsx`.

- Backend tim file SVG theo codepoint Kanji.
- Parse cac path SVG de lay stroke path va classify stroke type.
- Frontend hien thi tung step, previous/next/auto play.
- Response co source/license/source_url cua KanjiVG.

### 5.5 Quiz answer normalization

Nguon: `frontend/src/utils/quizAnswers.js`.

- `normalizeAnswer` trim, uppercase, bo dau `.` va `)`.
- Neu correct_answer la A/B/C/D thi so sanh theo letter.
- Neu correct_answer la `A. text`, `A) text`, `A text` thi tach letter.
- Neu correct_answer la full text va user chon letter, lay option text theo letter de so sanh.
- Neu user nhap full text va correct la letter, lay option text cua letter de so sanh.

### 5.6 Minigame Kanji Matching

Nguon: `frontend/src/pages/KanjiMinigame.jsx`.

- Data hien tai lay theo JLPT filter.
- Build pairs: left = Kanji, right = Vietnamese meaning.
- Shuffle hai cot rieng.
- Khi click mot Kanji va mot meaning:
  - Neu pairId trung, mark matched, tang correct, tang streak, disable.
  - Neu sai, highlight do 750ms, tang wrong, reset streak.
- Accuracy = correct / (correct + wrong) * 100.

## 6. Cau hoi bao ve va goi y tra loi

1. De tai giai quyet van de gi?
   - He thong ho tro nguoi Viet hoc tieng Nhat bang chat AI, Library tim kiem ngu nghia, grammar analysis, Kanji Canvas, quiz, flashcard va minigame.

2. Kien truc tong the gom nhung thanh phan nao?
   - React/Vite frontend, FastAPI backend, PostgreSQL, ChromaDB, Ollama LLM, PyTorch CNN, JSON dictionary/KanjiVG data.

3. Vi sao dung FastAPI?
   - FastAPI phu hop API JSON, co Pydantic validation, dependency injection cho auth/database va sinh OpenAPI docs.

4. Vi sao dung PostgreSQL?
   - Du lieu user, chat history, documents, Kanji, vocabulary co quan he ro rang nen can RDBMS; SQLAlchemy map cac bang nay.

5. Vi sao can ChromaDB?
   - De luu vector chunks cua document va tim ngu canh lien quan theo semantic search cho Library/Search/RAG.

6. RAG trong du an hoat dong nhu the nao?
   - Khi chat/search, he thong truy van ChromaDB lay context lien quan, ghep vao prompt cho LLM, sau do tra answer kem sources.

7. Neu ChromaDB loi khi them document thi sao?
   - Backend van luu PostgreSQL, tra `indexing_warning` "ChromaDB indexing failed but document was saved".

8. Tai sao bang documents khong co description?
   - Schema on dinh chi co title/content/type/JLPT/tags/source_url/metadata embedding. Preview sinh tu content 150 ky tu dau.

9. Auth duoc bao ve nhu the nao?
   - Mat khau hash bcrypt, login tao JWT HS256, route can auth lay user qua Bearer token va `get_current_active_user`.

10. Chat history luu nhung gi?
    - question, answer, jlpt_level, grammar_points, translation, sources va created_at theo user_id.

11. Chat co luon goi LLM khong?
    - Khong. Mot so case deterministic, single Kanji request va vocabulary MCQ co the tra loi tu rule/dictionary truoc khi goi LLM.

12. Lam sao he thong tranh tra loi sai ve tu N5 nhu `がくせい`?
    - `grammar_analyzer.py` co common vocab va deterministic analysis cho cau `「がくせい」はどういう意味ですか。`.

13. Grammar analysis output gom nhung phan nao?
    - Sentence meaning, Vocabulary, Grammar patterns, JLPT level, difficulty score va suggestions.

14. Difficulty score tinh ra sao?
    - Neu LLM khong tra hop le, sanitize map theo JLPT: N5 2.5, N4 4.0, N3 5.5, N2 7.5, N1 9.5.

15. Learning Library co nhung API nao?
    - documents CRUD, search, categories, stats, fetch-url va quiz pairs.

16. Semantic search co filter khong?
    - Co filter document_type va jlpt_level thong qua metadata `where` trong ChromaDB.

17. Khi delete document, ChromaDB co bi xoa theo khong?
    - Co, `library_service.delete_document` goi `chroma_service.delete_document(str(document_id))` truoc khi xoa DB record.

18. Kanji Canvas gui du lieu gi ve backend?
    - Gui image_data base64, strokes normalized, target_kanji va jlpt_level.

19. CNN nhan dang Kanji co kien truc gi?
    - 4 block Conv-BatchNorm-ReLU-Pool, AdaptiveAvgPool 4x4, classifier Linear 512 va output num_classes.

20. Vi sao can rerank sau CNN?
    - CNN chi dua vao anh; rerank them stroke count, JLPT va tan suat de tang do phu hop voi ngu canh hoc.

21. Neu model ML chua co file thi sao?
    - `kanji_recognizer.info()` tra unavailable, message yeu cau train model hoac them `kanji_model.pt` va `label_map.json`.

22. Du lieu correction cua nguoi dung luu o dau?
    - `backend/ml/user_samples/<sample_id>/image.png`, `strokes.json`, `metadata.json`.

23. KanjiVG duoc dung de lam gi?
    - Hien thi stroke order va metadata stroke count/nguon cho Kanji practice.

24. Quiz upload chap nhan format nao?
    - Excel tren backend va JSON tren frontend; flashcard import them CSV/JSON/Excel.

25. Header Excel quiz duoc xu ly ra sao?
    - Backend normalize header bang cach lowercase va bo ky tu khong phai alnum, map ve columns chuan.

26. Dap an A/B/C/D duoc validate the nao?
    - Frontend normalize answer, chap nhan `A`, `a`, `A.`, `A)`, full option text va `A. text`.

27. Quiz/Flashcard sets luu o dau?
    - Hien tai frontend luu trong localStorage, khong phai PostgreSQL.

28. Flashcard stats co theo tung set khong?
    - Co. Moi set co stats correct, wrong, streak, accuracy trong localStorage.

29. Xoa mot flashcard co xoa stats khong?
    - Theo `deleteFlashcardFromSet`, chi cap nhat cards, khong reset stats. Xoa ca set thi stats cua set do bien mat.

30. Kanji Matching Game lay data tu dau?
    - Gop backend dictionary, Library extracted Kanji va built-in dataset; sau do filter theo JLPT hien tai.

31. Diem manh cua project la gi?
    - Tich hop nhieu module hoc tieng Nhat: RAG, Library, Kanji Canvas, CNN, KanjiVG, quiz/flashcard va auth trong mot ung dung.

32. Han che lon nhat la gi?
    - Mot so du lieu hoc tap nhu quiz/flashcard sets dang luu localStorage; game_service backend con in-memory; LLM phu thuoc Ollama/model local.

33. Neu muon trien khai thuc te can lam gi?
    - Dua quiz/flashcard sets vao DB, harden secret/CORS, them migration on dinh, logging/monitoring, backup ChromaDB/PostgreSQL, test ML.

34. Vai tro cua Alembic la gi?
    - Quan ly migration DB. Repo co migration initial va migration them Kanji/vocabulary normalized relations.

35. Redis trong docker-compose co dang duoc dung trong code chinh khong?
    - Docker-compose co service Redis tuy chon, nhung trong cac luong chinh da doc chua thay code su dung Redis ro rang.

## 7. Diem manh, han che va huong phat trien

### Diem manh

- Kien truc tach lop ro: API routes, services, models, repositories, frontend pages/components.
- Co RAG voi Library: tai lieu do nguoi dung them co the duoc index vao ChromaDB.
- Co xu ly an toan sau LLM cho grammar, tranh mot so loi hallucination pho bien.
- Kanji Canvas co ca recognition, practice feedback, correction samples va stroke order.
- Learning Library CRUD day du, co stats, categories, search, detail modal.
- Quiz/Flashcard da to chuc theo sets, co filter va delete confirmation.

### Han che

- Quiz/flashcard sets chu yeu luu localStorage, nen chua dong bo theo user/server.
- Backend `game_service.py` con in-memory cho USER_QUIZ/USER_FLASHCARD.
- Mot so text UI va prompt file bi mojibake trong console/doc cu, can kiem tra encoding khi trinh bay.
- LLM output van phu thuoc chat model Ollama, can rule/sanitize nhieu hon neu dung san pham that.
- Recognition model chi ho tro nhom label N5-N4 theo code hien tai.
- Redis co trong Docker nhung chua thay duoc dung trong luong chinh.

### Huong phat trien

- Dua Quiz Sets va Flashcard Sets vao PostgreSQL, gan user_id va luu history hoc tap server-side.
- Them bang/thong ke rieng cho study progress, kanji practice attempts va quiz attempts.
- Bo sung test backend cho Library CRUD/search, grammar sanitizer, quiz import.
- Fine-tune CNN voi ETL10 va correction samples thuc te nhieu hon.
- Mo rong recognition labels sang N3-N1.
- Them rate limiting va audit log cho auth/chat.
- Cai thien multilingual prompt va encoding de dam bao tieng Viet hien dung o moi moi truong.
- Them dashboard analytics thuc su dua tren DB thay vi chi trang hien thi co san.

## 8. Kich ban demo 5-10 phut

### Phut 1: Dang nhap va gioi thieu tong quan

- Mo ung dung, dang nhap/dang ky.
- Gioi thieu sidebar: Chat, Grammar, Library, Games, Kanji Canvas, Profile.
- Noi ngan: "Day la ung dung hoc tieng Nhat cho nguoi Viet, tich hop AI, Library, Kanji Canvas va minigame."

### Phut 2: Chat AI

- Vao Chat.
- Gui cau: `「ねこ」と「いぬ」、どちらが好きですか。理由も教えてください。`
- Chi ra output co `[日本語]` va `[Tiếng Việt]`.
- Tim kiem chat history, cho thay messages theo thu tu cu -> moi va scroll cuoi.

### Phut 3: Grammar Analysis

- Vao Grammar.
- Nhap: `「がくせい」はどういう意味ですか。`
- Tick Include Vietnamese translation.
- Demo cac section: Sentence Meaning, Vocabulary, Grammar Patterns, JLPT Level, Learning Suggestions.
- Giai thich sanitizer dam bao `がくせい / 学生 = học sinh, sinh viên`.

### Phut 4-5: Learning Library

- Vao Library.
- Chi stats: Total Documents, Document Types, JLPT Levels, Vector Chunks.
- Add New Document voi title/content/type/JLPT/tags.
- Save va noi backend luu PostgreSQL + index ChromaDB.
- Search query co filter type/JLPT, xem relevance score.
- Mo detail modal, edit, delete confirmation.

### Phut 6: Kanji Canvas

- Vao Kanji Canvas.
- Mode Explore: loc N5/N4, chon mot Kanji.
- Mode Stroke Order: auto play stroke order tu KanjiVG.
- Mode Recognize: viet mot Kanji tren canvas, bam Recognize.
- Giai thich image base64 -> CNN -> rerank stroke count/JLPT -> predictions.
- Neu confidence thap, demo correction.

### Phut 7: Kanji Matching Game

- Vao Games / Kanji.
- Chon mode Kanji Matching Game.
- Loc JLPT N5.
- Click mot Kanji va mot nghia tieng Viet.
- Chi Correct/Wrong/Accuracy/Streak va Reset.

### Phut 8: Quiz Upload va Quiz Play

- Vao Quiz Upload.
- Neu co file mau, upload Excel/JSON.
- Mo Quiz Play, chi Saved Quiz Sets: title, questions, JLPT, created date, Play/Delete.
- Chon option A/B/C/D, giai thich validation chap nhan `A`, `A.`, `A)` va full text.

### Phut 9: Flashcard Sets

- Vao Flashcard.
- Chi dashboard: Total Sets, Total Cards, Recently Studied, Study Progress.
- Tao/import set, filter by JLPT/category/source.
- Study set, flip card, mark Correct/Wrong, quay lai xem stats cap nhat.

### Phut 10: Ket luan

- Tong ket diem noi bat: AI chat + RAG, Library, Kanji Canvas CNN, KanjiVG, quiz/flashcard.
- Neu hoi huong phat trien: dua quiz/flashcard vao DB, mo rong CNN N3-N1, them analytics va test.

## 9. File can nho khi bao ve

- Backend app: `backend/app/main.py`.
- Models: `backend/app/models/database.py`, `backend/app/models/schemas.py`.
- Auth: `backend/app/api/auth.py`, `backend/app/core/auth.py`.
- Chat/RAG: `backend/app/api/chat.py`, `backend/app/services/chat_prompt.py`, `backend/app/services/vector_db.py`.
- Library: `backend/app/api/library.py`, `backend/app/services/library_service.py`.
- Grammar: `backend/app/api/analysis.py`, `backend/app/services/grammar_analyzer.py`.
- Kanji API: `backend/app/api/kanji.py`.
- Kanji ML: `backend/ml/kanji_model.py`, `backend/ml/kanji_recognizer.py`, `backend/ml/train_kanji_model.py`.
- Frontend routes: `frontend/src/App.tsx`.
- API client: `frontend/src/services/api.ts`, `frontend/src/services/api.js`.
- Chat UI: `frontend/src/pages/Chat.tsx`.
- Library UI: `frontend/src/pages/Library.tsx`.
- Kanji Canvas UI: `frontend/src/pages/Kanji.jsx`, `frontend/src/components/kanji/KanjiCanvas.jsx`.
- Kanji game: `frontend/src/pages/KanjiMinigame.jsx`.
- Quiz: `frontend/src/pages/QuizUpload.jsx`, `frontend/src/pages/QuizPlay.jsx`, `frontend/src/utils/quizAnswers.js`.
- Flashcard: `frontend/src/pages/Flashcard.jsx`, `frontend/src/pages/FlashcardPlay.jsx`, `frontend/src/utils/storage.js`.
