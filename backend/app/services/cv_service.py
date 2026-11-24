"""CV Parsing, RAG Knowledge Indexing, and Technical Interview Evaluation Service for SenpaiAI."""

import io
import json
import logging
import re
from typing import Any, Dict, List, Optional
import pypdf
import docx

from .llm_service import japanese_service
from .vector_db import chroma_service

logger = logging.getLogger(__name__)

# Curated Japanese IT Technical Knowledge Corpus for RAG grounding
IT_TECHNICAL_KNOWLEDGE_CORPUS = [
    {
        "id": "tech_arch_microservices",
        "title": "Kiến trúc Microservices & Distributed Systems",
        "document_type": "technical_standard",
        "jlpt_level": "N2",
        "tags": ["microservices", "architecture", "docker", "distributed"],
        "content": (
            "Microservices Architecture (マイクロサービス設計):\n"
            "- Tách biệt nghiệp vụ theo Bounded Context (Domain-Driven Design).\n"
            "- Giao tiếp qua REST API (JSON/HTTP) hoặc gRPC (Protocol Buffers) cho độ trễ thấp.\n"
            "- Xử lý bất đồng bộ qua Message Queue / Broker (RabbitMQ, Apache Kafka, AWS SQS).\n"
            "- Xử lý lỗi phân tán: Circuit Breaker pattern, Retry với Exponential Backoff, Idempotency (冪等性).\n"
            "- Cơ sở dữ liệu: Database-per-service, giải quyết tính toàn vẹn bằng SAGA pattern thay cho Two-Phase Commit."
        )
    },
    {
        "id": "tech_backend_concurrency",
        "title": "Backend Concurrency, Async I/O & FastAPI/Node.js",
        "document_type": "technical_standard",
        "jlpt_level": "N2",
        "tags": ["fastapi", "python", "async", "concurrency", "performance"],
        "content": (
            "Xử lý đồng thời (Concurrency) và Bất đồng bộ (Asynchronous I/O):\n"
            "- Single Event Loop (asyncio trong Python, libuv trong Node.js) tối ưu cho I/O-bound tasks.\n"
            "- Đối với CPU-bound tasks: cần sử dụng Multiprocessing hoặc Background Worker (Celery, RQ) để không block event loop.\n"
            "- Connection Pooling: duy trì pool kết nối DB (SQLAlchemy pool_size, max_overflow) tránh quá tải socket.\n"
            "- Quản lý Transactions (ACID): Commit rõ ràng, Rollback khi exception, tránh deadlocks bằng cách giữ lock thời gian ngắn nhất."
        )
    },
    {
        "id": "tech_db_optimization",
        "title": "Tối ưu hóa Database & Caching (PostgreSQL, MySQL, Redis)",
        "document_type": "technical_standard",
        "jlpt_level": "N2",
        "tags": ["database", "sql", "redis", "indexing", "performance"],
        "content": (
            "Tối ưu hóa Database & Chiến lược Caching:\n"
            "- Indexing: B-Tree Index cho so sánh bằng (=) và khoảng (<, >), Composite Index cần tuân thủ Leftmost Prefix rule.\n"
            "- Giải quyết vấn đề N+1 Query: Sử dụng Joined Load / Eager Loading (selectinload, joinedload trong ORM).\n"
            "- Chiến lược Cache: Cache-Aside (Lazy Loading), Write-Through, Write-Back.\n"
            "- Phòng tránh sự cố Cache: Cache Breakdown (Mutex lock), Cache Penetration (Bloom Filter / Cache Null), Cache Avalanche (TTL ngẫu nhiên jitter)."
        )
    },
    {
        "id": "tech_frontend_performance",
        "title": "Hiệu năng Frontend & State Management (React, TypeScript, Redux/Zustand)",
        "document_type": "technical_standard",
        "jlpt_level": "N3",
        "tags": ["react", "typescript", "frontend", "optimization"],
        "content": (
            "Tối ưu hóa Frontend React & Kiến trúc Client:\n"
            "- Tránh Re-render thừa: Sử dụng React.memo, useCallback, useMemo cho các component tốn chi phí tính toán.\n"
            "- Virtualized Lists (react-window) cho danh sách hàng nghìn items.\n"
            "- Code splitting & Lazy Loading: React.lazy và Suspense để giảm Initial Bundle Size.\n"
            "- State Management: Phân tách Server State (React Query / TanStack Query) và Client UI State (Zustand, Redux Toolkit)."
        )
    },
    {
        "id": "tech_japan_horensou_prep",
        "title": "Tác phong trả lời Phỏng vấn Kỹ thuật Nhật Bản & Phương pháp PREP",
        "document_type": "technical_standard",
        "jlpt_level": "N3",
        "tags": ["prep", "horensou", "interview", "keigo", "business"],
        "content": (
            "Phương pháp trả lời phỏng vấn kỹ thuật theo chuẩn PREP của Nhật Bản:\n"
            "1. P (Point - 結論): Trả lời trực diện vào câu hỏi trước tiên (「結論から申し上げますと...」).\n"
            "2. R (Reason - 理由): Giải thích nguyên nhân hoặc cơ sở kỹ thuật (「その理由は...」).\n"
            "3. E (Example / Evidence - 具体例): Đưa ra số liệu, dự án thực tế trong CV đã thực hiện (「具体的には、前職の開発におきまして...」).\n"
            "4. P (Point - 結び): Khẳng định lại giá trị hoặc hướng đóng góp cho dự án (「したがって、御社の開発でも...」).\n"
            "- Tinh thần Ho-Ren-So (報連相): Khi gặp lỗi, báo cáo sớm, nêu giả thuyết và đề xuất ít nhất 2 phương án xử lý."
        )
    }
]


def ensure_knowledge_base_seeded():
    """Seed technical corpus into ChromaDB if not already present."""
    try:
        existing = chroma_service.records
        docs_to_add = []
        for item in IT_TECHNICAL_KNOWLEDGE_CORPUS:
            rec_id = f"{item['id']}_0"
            if rec_id not in existing:
                docs_to_add.append(item)
        if docs_to_add:
            chroma_service.add_documents(docs_to_add)
            logger.info("[CVService] Seeded %d technical standards into ChromaDB", len(docs_to_add))
    except Exception as exc:
        logger.warning("[CVService] Error seeding technical knowledge base: %s", exc)


def extract_cv_text_from_file(file_bytes: bytes, filename: str) -> str:
    """Extracts raw text from uploaded CV file (.pdf, .docx, .txt, .md)."""
    filename_lower = filename.lower()
    
    if filename_lower.endswith(".pdf"):
        try:
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            pages_text = []
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    pages_text.append(text)
            return "\n\n".join(pages_text).strip()
        except Exception as exc:
            logger.error("[CVService] PDF extraction failed: %s", exc)
            raise ValueError(f"Không thể đọc file PDF: {str(exc)}")
            
    elif filename_lower.endswith(".docx"):
        try:
            doc = docx.Document(io.BytesIO(file_bytes))
            paras = [p.text for p in doc.paragraphs if p.text.strip()]
            return "\n".join(paras).strip()
        except Exception as exc:
            logger.error("[CVService] DOCX extraction failed: %s", exc)
            raise ValueError(f"Không thể đọc file Word DOCX: {str(exc)}")
            
    else:
        # Default decode as utf-8 text
        try:
            return file_bytes.decode("utf-8").strip()
        except UnicodeDecodeError:
            try:
                return file_bytes.decode("latin-1").strip()
            except Exception as exc:
                raise ValueError(f"Không thể đọc định dạng văn bản: {str(exc)}")


async def parse_candidate_cv(cv_text: str) -> Dict[str, Any]:
    """Uses LLM to extract structured profile, tech stack, and key projects from CV."""
    system_prompt = (
        "Bạn là chuyên gia phân tích CV kỹ thuật (Technical Recruiter) cho các công ty IT Nhật Bản.\n"
        "Hãy đọc nội dung CV được cung cấp và trích xuất thông tin cấu trúc dưới định dạng JSON duy nhất.\n"
        "Cấu trúc JSON yêu cầu:\n"
        "{\n"
        '  "candidate_name": "Tên ứng viên",\n'
        '  "target_role": "Vị trí ứng tuyển (ví dụ: Fullstack Developer / Backend Engineer)",\n'
        '  "experience_years": "Số năm kinh nghiệm (ví dụ: 2 năm)",\n'
        '  "technical_skills": ["Python", "FastAPI", "React", "Docker", "PostgreSQL"],\n'
        '  "japanese_level": "Trình độ tiếng Nhật ước lượng (ví dụ: N3, N2, hoặc Giao tiếp cơ bản)",\n'
        '  "key_projects": [\n'
        '    {\n'
        '      "name": "Tên dự án",\n'
        '      "tech_stack": ["FastAPI", "PostgreSQL", "Redis"],\n'
        '      "description": "Mô tả ngắn gọn chức năng chính",\n'
        '      "responsibilities": "Vai trò và nhiệm vụ cụ thể",\n'
        '      "challenges_solved": "Vấn đề kỹ thuật đã xử lý (ví dụ: tối ưu truy vấn, xử lý race condition)"\n'
        '    }\n'
        '  ],\n'
        '  "highlights": "Điểm mạnh nổi bật nhất của ứng viên bằng tiếng Việt"\n'
        "}\n"
        "Chỉ trả lời JSON hợp lệ, không kèm bất kỳ văn bản giải thích nào khác."
    )

    try:
        raw_reply = await japanese_service.voice_completion(system_prompt, f"Nội dung CV:\n{cv_text[:4000]}")
        clean_json = raw_reply.strip()
        clean_json = re.sub(r"^```(?:json)?\s*|\s*```$", "", clean_json, flags=re.IGNORECASE).strip()
        
        match = re.search(r"\{.*\}", clean_json, re.DOTALL)
        if match:
            clean_json = match.group(0)
            
        data = json.loads(clean_json)
        return {
            "candidate_name": data.get("candidate_name") or "Ứng viên",
            "target_role": data.get("target_role") or "Kỹ sư phần mềm IT",
            "experience_years": data.get("experience_years") or "1-2 năm",
            "technical_skills": data.get("technical_skills") or ["Python", "TypeScript", "React", "Database"],
            "japanese_level": data.get("japanese_level") or "N3 (Giao tiếp công sở)",
            "key_projects": data.get("key_projects") or [],
            "highlights": data.get("highlights") or "Kỹ năng lập trình tốt và tư duy giải quyết vấn đề.",
            "raw_text_length": len(cv_text)
        }
    except Exception as exc:
        logger.warning("[CVService] AI CV parsing failed, using heuristic fallback: %s", exc)
        return heuristic_cv_parser(cv_text)


def heuristic_cv_parser(cv_text: str) -> Dict[str, Any]:
    """Smart fallback parser when LLM is unavailable."""
    skills_catalog = [
        "Python", "FastAPI", "Django", "Flask", "JavaScript", "TypeScript",
        "React", "Vue", "Next.js", "Node.js", "Docker", "Kubernetes",
        "PostgreSQL", "MySQL", "MongoDB", "Redis", "AWS", "Git", "Linux",
        "REST API", "GraphQL", "Microservices", "CI/CD", "Three.js"
    ]
    detected_skills = [s for s in skills_catalog if re.search(r"\b" + re.escape(s) + r"\b", cv_text, re.IGNORECASE)]
    if not detected_skills:
        detected_skills = ["TypeScript", "React", "Node.js", "SQL"]

    # Detect candidate name
    first_lines = [line.strip() for line in cv_text.splitlines() if line.strip()][:5]
    candidate_name = "Ứng viên"
    for line in first_lines:
        if len(line) < 35 and not any(kw in line.lower() for kw in ["cv", "resume", "curriculum", "thông tin", "email"]):
            candidate_name = line
            break

    return {
        "candidate_name": candidate_name,
        "target_role": "Kỹ sư Phần mềm (Fullstack / Backend Developer)",
        "experience_years": "2 năm kinh nghiệm",
        "technical_skills": detected_skills[:8],
        "japanese_level": "N3 (Giao tiếp công sở IT)",
        "key_projects": [
            {
                "name": "Dự án phát triển hệ thống Web Application",
                "tech_stack": detected_skills[:4],
                "description": "Xây dựng backend API và frontend tương tác người dùng.",
                "responsibilities": "Thiết kế kiến trúc API, tối ưu truy vấn cơ sở dữ liệu và tích hợp CI/CD.",
                "challenges_solved": "Tối ưu hóa thời gian phản hồi API và giảm thiểu lỗi đồng thời."
            }
        ],
        "highlights": f"Nắm vững các công nghệ {', '.join(detected_skills[:4])} và có kinh nghiệm triển khai dự án thực tế.",
        "raw_text_length": len(cv_text)
    }


def index_cv_into_rag(user_id: int, parsed_cv: Dict[str, Any], raw_cv_text: str) -> List[str]:
    """Indexes candidate CV chunks into ChromaDB so RAG can cross-reference during interview."""
    ensure_knowledge_base_seeded()
    
    docs = []
    prefix = f"user_{user_id}_cv"
    
    # Chunk 1: Overall candidate profile
    docs.append({
        "id": f"{prefix}_profile",
        "title": f"Hồ sơ ứng viên: {parsed_cv.get('candidate_name', 'Ứng viên')}",
        "document_type": "candidate_cv",
        "jlpt_level": parsed_cv.get("japanese_level", "N3"),
        "tags": ["profile", "candidate"] + parsed_cv.get("technical_skills", []),
        "content": (
            f"Ứng viên: {parsed_cv.get('candidate_name')}\n"
            f"Vị trí mục tiêu: {parsed_cv.get('target_role')}\n"
            f"Kinh nghiệm: {parsed_cv.get('experience_years')}\n"
            f"Kỹ năng kỹ thuật: {', '.join(parsed_cv.get('technical_skills', []))}\n"
            f"Trình độ tiếng Nhật: {parsed_cv.get('japanese_level')}\n"
            f"Điểm mạnh nổi bật: {parsed_cv.get('highlights')}"
        )
    })
    
    # Chunks for each key project
    for i, proj in enumerate(parsed_cv.get("key_projects", []), 1):
        docs.append({
            "id": f"{prefix}_project_{i}",
            "title": f"Dự án CV #{i}: {proj.get('name', 'Dự án')}",
            "document_type": "candidate_cv_project",
            "jlpt_level": "N3",
            "tags": proj.get("tech_stack", []),
            "content": (
                f"Dự án: {proj.get('name')}\n"
                f"Công nghệ sử dụng: {', '.join(proj.get('tech_stack', []))}\n"
                f"Mô tả: {proj.get('description')}\n"
                f"Nhiệm vụ: {proj.get('responsibilities')}\n"
                f"Khó khăn & Giải pháp: {proj.get('challenges_solved')}"
            )
        })

    # Additional raw text chunks if long
    if len(raw_cv_text) > 300:
        docs.append({
            "id": f"{prefix}_raw_experience",
            "title": f"Kinh nghiệm chi tiết từ CV của {parsed_cv.get('candidate_name')}",
            "document_type": "candidate_cv_raw",
            "jlpt_level": "N3",
            "tags": ["raw_experience"],
            "content": raw_cv_text[:1200]
        })
        
    added_ids = chroma_service.add_documents(docs)
    logger.info("[CVService] Successfully indexed %d CV documents for user %d into RAG", len(added_ids), user_id)
    return added_ids


async def generate_technical_questions_from_cv(
    user_id: int,
    parsed_cv: Dict[str, Any],
    industry_id: str = "it"
) -> List[Dict[str, Any]]:
    """Uses RAG to generate 4 tailored technical interview questions based on candidate CV."""
    ensure_knowledge_base_seeded()
    
    skills = parsed_cv.get("technical_skills", ["Python", "FastAPI", "React"])
    skills_query = " ".join(skills[:5])
    
    # Retrieve technical standards relevant to candidate's skills
    rag_standards = chroma_service.search_documents(
        query=f"kiến trúc lập trình {skills_query} tối ưu hiệu năng",
        n_results=3,
        filter_dict={"document_type": "technical_standard"}
    )
    rag_context = "\n---\n".join([f"{item['metadata'].get('title')}:\n{item['content']}" for item in rag_standards])

    projects_summary = "\n".join([
        f"- {p.get('name')}: Dùng {', '.join(p.get('tech_stack', []))}. Nhiệm vụ: {p.get('responsibilities')}. Giải quyết: {p.get('challenges_solved')}"
        for p in parsed_cv.get("key_projects", [])[:2]
    ])

    system_prompt = (
        "Bạn là Giám đốc Kỹ thuật (CTO) Takahashi Kenichi của công ty IT Nhật Bản NexTech Tokyo.\n"
        "Dựa trên CV của ứng viên và tiêu chuẩn kỹ thuật RAG được cung cấp, hãy tạo đúng 4 câu hỏi phỏng vấn kỹ thuật chuyên sâu bằng tiếng Nhật và tiếng Việt.\n"
        "Cấu trúc 4 vòng:\n"
        "1. Vòng 1 (自己紹介と技術スタック): Chào hỏi, yêu cầu ứng viên giới thiệu tổng quan về bản thân và tech stack chính mà họ đã liệt kê trong CV.\n"
        "2. Vòng 2 (コア技術の深掘り): Hỏi sâu về 1 công nghệ cốt lõi trong CV (ví dụ: Async I/O, Database Indexing, Caching, hoặc React Optimization).\n"
        "3. Vòng 3 (プロジェクト課題解決と設計): Hỏi trực tiếp vào 1 dự án cụ thể trong CV của ứng viên, yêu cầu giải thích về kiến trúc hoặc cách họ giải quyết vấn đề kỹ thuật lớn nhất.\n"
        "4. Vòng 4 (品質管理・チーム開発・逆質問): Hỏi về quy trình đảm bảo chất lượng code (Code Review, Test, CI/CD), tinh thần Ho-Ren-So và mời ứng viên đặt câu hỏi ngược (逆質問) cho CTO.\n\n"
        "Yêu cầu định dạng: Trả về duy nhất một mảng JSON 4 phần tử theo mẫu sau:\n"
        "[\n"
        "  {\n"
        '    "turn": 1,\n'
        '    "question_ja": "Câu hỏi tiếng Nhật lịch sự và tự nhiên của CTO",\n'
        '    "question_vi": "Bản dịch tiếng Việt chính xác",\n'
        '    "focus": "Mục tiêu đánh giá vòng này",\n'
        '    "expected_criteria": "Các từ khóa/khái niệm kỹ thuật mà ứng viên cần nhắc tới",\n'
        '    "hints": ["Gợi ý câu mở đầu tiếng Nhật 1", "Gợi ý 2"]\n'
        "  }\n"
        "]\n"
        "Chỉ trả lời JSON hợp lệ, không có chữ nào khác."
    )

    user_prompt = (
        f"Ứng viên: {parsed_cv.get('candidate_name')} ({parsed_cv.get('target_role')})\n"
        f"Kỹ năng: {', '.join(skills)}\n"
        f"Dự án nổi bật trong CV:\n{projects_summary}\n\n"
        f"Tiêu chuẩn kỹ thuật RAG tham khảo:\n{rag_context}"
    )

    try:
        raw_reply = await japanese_service.voice_completion(system_prompt, user_prompt)
        clean_json = raw_reply.strip()
        clean_json = re.sub(r"^```(?:json)?\s*|\s*```$", "", clean_json, flags=re.IGNORECASE).strip()
        
        match = re.search(r"\[\s*\{.*\}\s*\]", clean_json, re.DOTALL)
        if match:
            clean_json = match.group(0)
            
        questions = json.loads(clean_json)
        if isinstance(questions, list) and len(questions) == 4:
            # Normalize turn numbers
            for idx, q in enumerate(questions, 1):
                q["turn"] = idx
            return questions
    except Exception as exc:
        logger.warning("[CVService] AI question generation failed, using dynamic template: %s", exc)

    return get_fallback_technical_questions(parsed_cv)


def get_fallback_technical_questions(parsed_cv: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Generates high quality tailored questions when LLM service is busy."""
    skills = parsed_cv.get("technical_skills", ["Python", "FastAPI", "React", "Docker"])
    primary_tech = skills[0] if skills else "Web Fullstack"
    secondary_tech = skills[1] if len(skills) > 1 else "Database"
    
    first_project = "dự án gần nhất"
    if parsed_cv.get("key_projects"):
        first_project = parsed_cv["key_projects"][0].get("name", "dự án trong CV")

    return [
        {
            "turn": 1,
            "question_ja": f"本日はお越しいただき、ありがとうございます。CVを拝見しましたところ、{primary_tech}や{secondary_tech}を中心にご活躍されていると伺いました。まず自己紹介と、これまでの主な技術スタックについてお話しいただけますでしょうか。",
            "question_vi": f"Cảm ơn bạn đã đến tham gia phỏng vấn hôm nay. Qua CV, tôi thấy bạn có thế mạnh về {primary_tech} và {secondary_tech}. Trước tiên, xin mời bạn giới thiệu bản thân và tổng quan về tech stack chính bạn từng làm việc.",
            "focus": "自己紹介 & 技術スタック (Giới thiệu bản thân và tổng quan công nghệ trong CV theo chuẩn PREP).",
            "expected_criteria": f"{primary_tech}, {secondary_tech}, số năm kinh nghiệm, vai trò trong dự án.",
            "hints": [
                "はじめまして。〇〇と申します。専攻はソフトウェア開発で、主に...を扱ってまいりました。",
                "これまで主にバックエンド（フロントエンド）開発を担当し、チームでの開発経験がございます。",
                "本日はどうぞよろしくお願いいたします。"
            ]
        },
        {
            "turn": 2,
            "question_ja": f"ありがとうございます。技術的な質問に入りますが、{primary_tech}を用いた開発において、大量のアクセスやデータの負荷を考慮したパフォーマンス最適化（キャッシュや並行処理など）で工夫された点があれば教えてください。",
            "question_vi": f"Cảm ơn bạn. Tiếp theo là câu hỏi kỹ thuật: Trong quá trình phát triển với {primary_tech}, khi phải xử lý tải lớn (cache, xử lý đồng thời, tối ưu truy vấn), bạn đã có những giải pháp hoặc kinh nghiệm tối ưu nào cụ thể?",
            "focus": f"技術の深掘り (Đánh giá kiến thức chuyên sâu về tối ưu hóa hiệu năng với {primary_tech}).",
            "expected_criteria": "Indexing, Caching (Redis), Asynchronous I/O, Connection Pool, Bottleneck analysis.",
            "hints": [
                "結論から申し上げますと、キャッシュ戦略とインデックス設計を徹底いたしました。(Về mặt kết luận, tôi áp dụng cache và đánh index)",
                "具体的には、頻繁に参照されるデータにRedisを導入し、レスポンス時間を短縮しました。(Cụ thể là áp dụng Redis cho dữ liệu đọc thường xuyên)"
            ]
        },
        {
            "turn": 3,
            "question_ja": f"CVに記載されていた「{first_project}」について伺います。このプロジェクトで最も技術的に困難だった課題やバグは何でしたか？また、それをどのように解決されましたか？",
            "question_vi": f"Tôi muốn hỏi về dự án 「{first_project}」 trong CV của bạn. Trong dự án này, thách thức kỹ thuật hoặc lỗi nghiêm trọng nhất mà bạn gặp phải là gì? Và bạn đã giải quyết nó như thế nào?",
            "focus": "実務課題解決力 (Khả năng phân tích root cause, debug và tư duy kiến trúc trong dự án thực tế).",
            "expected_criteria": "Mô tả vấn đề cụ thể, nguyên nhân gốc rễ (root cause), giải pháp kỹ thuật, kết quả đạt được.",
            "hints": [
                "最も苦労した点は、APIのレスポンス遅延（またはデータの整合性）でした。(Điểm khó khăn nhất là độ trễ API / tính nhất quán dữ liệu)",
                "ログを詳細に分析し、原因を特定した上で、クエリの改善とリファクタリングを行いました。(Phân tích log, tìm nguyên nhân và refactor query)"
            ]
        },
        {
            "turn": 4,
            "question_ja": "最後に、品質管理（テストやコードレビュー）において大切にしていることと、弊社や私（CTO）に対して何か質問（逆質問）はございますでしょうか。",
            "question_vi": "Cuối cùng, bạn coi trọng điều gì trong việc đảm bảo chất lượng phần mềm (testing, code review, Ho-Ren-So), và bạn có câu hỏi nào muốn hỏi chúng tôi (câu hỏi ngược cho CTO) không?",
            "focus": "品質意識・チーム開発・逆質問 (Ý thức chất lượng, tinh thần đồng đội và sự chủ động tìm hiểu doanh nghiệp).",
            "expected_criteria": "Unit test, CI/CD, Code review checklist, tinh thần cầu thị, câu hỏi ngược thể hiện tầm nhìn kỹ thuật.",
            "hints": [
                "コードの可読性と自動テストのカバレッジを常に意識しております。(Luôn chú trọng tính dễ đọc của code và coverage kiểm thử)",
                "御社で現在最も注力されている技術的チャレンジについて教えていただけますでしょうか。(Em có thể hỏi về thách thức kỹ thuật lớn nhất hiện tại của quý công ty không ạ?)"
            ]
        }
    ]


async def evaluate_turn_with_ai_rag(
    user_id: int,
    question_data: Dict[str, Any],
    user_text: str,
    turn_number: int,
    parsed_cv: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Grounds the candidate's answer with RAG (CV facts + Technical standards) and scores 4 pillars."""
    ensure_knowledge_base_seeded()
    
    # 1. RAG Retrieve matching CV chunks
    cv_search = chroma_service.search_documents(
        query=f"{user_text} {question_data.get('expected_criteria', '')}",
        n_results=2,
        filter_dict={"document_type": "candidate_cv_project"}
    )
    cv_context = "\n".join([c["content"] for c in cv_search]) if cv_search else "Hồ sơ kỹ sư IT tổng quan."

    # 2. RAG Retrieve matching Technical Standards
    tech_search = chroma_service.search_documents(
        query=f"{question_data.get('expected_criteria', '')} {user_text}",
        n_results=2,
        filter_dict={"document_type": "technical_standard"}
    )
    tech_context = "\n".join([t["content"] for t in tech_search]) if tech_search else "Chuẩn mực phát triển phần mềm doanh nghiệp Nhật."

    system_prompt = (
        "Bạn là Giám đốc Kỹ thuật kiêm Giám khảo Phỏng vấn của công ty IT Nhật Bản.\n"
        "Bạn đang phỏng vấn một kỹ sư phần mềm. Hãy đánh giá câu trả lời của ứng viên dựa trên RAG Context (CV ứng viên & Tiêu chuẩn kỹ thuật IT Nhật Bản).\n"
        "Đánh giá chính xác theo 4 trụ cột thang điểm 0-100:\n"
        "1. technical_score (0-100): Độ chính xác và chiều sâu kỹ thuật (thuật ngữ, kiến trúc, phương án tối ưu, tư duy xử lý vấn đề).\n"
        "2. keigo_score (0-100): Kính ngữ và độ lịch thiệp tiếng Nhật (Desu/Masu, Khiêm nhường ngữ/Tôn kính ngữ).\n"
        "3. manner_score (0-100): Tác phong công sở Nhật Bản & Tư duy PREP (kết luận trước, giải thích lý do, đưa ví dụ dự án).\n"
        "4. cv_alignment_score (0-100): Độ ăn khớp với các dự án và kỹ năng đã nêu trong CV.\n\n"
        "Tạo câu trả lời mẫu tiếng Nhật chuẩn mực (`corrected_sentence`) mà một Senior Japanese IT Engineer sẽ trả lời.\n"
        "Viết nhận xét chuyên sâu bằng tiếng Việt:\n"
        "- `technical_advice_vi`: Nhận xét rõ ràng về mặt chuyên môn kỹ thuật, khen điểm đúng và chỉ ra chi tiết kỹ thuật còn thiếu.\n"
        "- `advice_vi`: Nhận xét về tác phong, kính ngữ và cách trình bày theo chuẩn PREP/Ho-Ren-So.\n"
        "- `npc_reaction`: 'happy' | 'neutral' | 'thinking' | 'strict' | 'surprised'\n"
        "- `npc_followup_ja`: Câu chuyển tiếp tự nhiên của CTO bằng tiếng Nhật.\n"
        "- `npc_followup_vi`: Bản dịch tiếng Việt của câu chuyển tiếp.\n\n"
        "Chỉ trả lời duy nhất JSON hợp lệ theo cấu trúc:\n"
        "{\n"
        '  "technical_score": 88,\n'
        '  "keigo_score": 85,\n'
        '  "manner_score": 90,\n'
        '  "cv_alignment_score": 92,\n'
        '  "corrected_sentence": "Câu tiếng Nhật chuẩn kỹ sư Nhật",\n'
        '  "technical_advice_vi": "Nhận xét chuyên môn kỹ thuật...",\n'
        '  "advice_vi": "Nhận xét kính ngữ và tác phong...",\n'
        '  "npc_reaction": "happy",\n'
        '  "npc_followup_ja": "なるほど、素晴らしい知見ですね。",\n'
        '  "npc_followup_vi": "Ra là vậy, giải pháp rất thuyết phục."\n'
        "}"
    )

    user_prompt = (
        f"Câu hỏi CTO ({turn_number}/4): {question_data.get('question_ja')}\n"
        f"Mục tiêu đánh giá: {question_data.get('focus')}\n"
        f"Tiêu chuẩn kỹ thuật mong đợi: {question_data.get('expected_criteria')}\n"
        f"Câu trả lời của ứng viên: {user_text}\n\n"
        f"[RAG Context - Thông tin CV ứng viên]:\n{cv_context}\n\n"
        f"[RAG Context - Tiêu chuẩn kỹ thuật IT]:\n{tech_context}"
    )

    try:
        raw_reply = await japanese_service.voice_completion(system_prompt, user_prompt)
        clean_json = raw_reply.strip()
        clean_json = re.sub(r"^```(?:json)?\s*|\s*```$", "", clean_json, flags=re.IGNORECASE).strip()
        
        match = re.search(r"\{.*\}", clean_json, re.DOTALL)
        if match:
            clean_json = match.group(0)
            
        data = json.loads(clean_json)
        return {
            "technical_score": max(50, min(100, int(data.get("technical_score", 82)))),
            "grammar_score": max(50, min(100, int(data.get("keigo_score", 80)))),
            "keigo_score": max(50, min(100, int(data.get("keigo_score", 80)))),
            "manner_score": max(50, min(100, int(data.get("manner_score", 85)))),
            "cv_alignment_score": max(50, min(100, int(data.get("cv_alignment_score", 85)))),
            "corrected_sentence": data.get("corrected_sentence", user_text),
            "technical_advice_vi": data.get("technical_advice_vi", "Phân tích kỹ thuật rõ ràng và đúng trọng tâm."),
            "advice_vi": data.get("advice_vi", "Tác phong trả lời tự tin, đúng chuẩn kinh doanh Nhật."),
            "npc_reaction": data.get("npc_reaction", "happy"),
            "npc_followup_ja": data.get("npc_followup_ja", "承知いたしました。大変よく理解できました。"),
            "npc_followup_vi": data.get("npc_followup_vi", "Tôi đã hiểu rất rõ phương án kỹ thuật của bạn.")
        }
    except Exception as exc:
        logger.warning("[CVService] AI evaluation failed, using grounded heuristic evaluation: %s", exc)
        return grounded_heuristic_evaluation(user_text, question_data)


def grounded_heuristic_evaluation(user_text: str, question_data: Dict[str, Any]) -> Dict[str, Any]:
    """Smart fallback evaluation for CV technical answers."""
    has_desu_masu = "です" in user_text or "ます" in user_text
    has_keigo = any(w in user_text for w in ["申します", "存じます", "参りました", "いたし", "恐縮", "お世話"])
    has_prep = any(w in user_text for w in ["結論", "理由", "具体的", "結果", "そのため"])
    
    # Check technical keywords
    tech_keywords = ["api", "database", "sql", "cache", "redis", "index", "async", "docker", "react", "fastapi", "bug", "log", "test"]
    user_lower = user_text.lower()
    tech_count = sum(1 for kw in tech_keywords if kw in user_lower)
    
    technical = 85 if tech_count >= 2 else (75 if tech_count == 1 else 68)
    keigo = 90 if has_keigo else (80 if has_desu_masu else 65)
    manner = 88 if has_prep else 78
    alignment = 85

    return {
        "technical_score": technical,
        "grammar_score": keigo,
        "keigo_score": keigo,
        "manner_score": manner,
        "cv_alignment_score": alignment,
        "corrected_sentence": user_text if has_desu_masu else f"{user_text}と考えております。",
        "technical_advice_vi": "Bạn đã đề cập được các khái niệm kỹ thuật cơ bản. Để tạo ấn tượng mạnh hơn với CTO, hãy nêu thêm số liệu cụ thể (ví dụ: giảm thời gian query từ 500ms xuống 50ms) hoặc giải pháp phòng ngừa rủi ro.",
        "advice_vi": "Cách phát biểu mạch lạc. Nên áp dụng công thức PREP: Nêu kết luận trước (「結論から申し上げますと...」), sau đó giải thích chi tiết để câu trả lời thêm phần sắc bén.",
        "npc_reaction": "happy" if (technical + keigo + manner) // 3 >= 80 else "thinking",
        "npc_followup_ja": "ありがとうございます。技術的なアプローチがよく分かりました。",
        "npc_followup_vi": "Cảm ơn bạn. Tôi đã hiểu rõ hướng tiếp cận kỹ thuật của bạn."
    }
