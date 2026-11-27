import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText,
  Upload,
  Sparkles,
  CheckCircle2,
  X,
  Code2,
  Briefcase,
  ArrowRight,
  Zap,
} from 'lucide-react'
import { internshipAPI, type ParsedCVProfile } from '../../services/api'
import { toast } from 'react-hot-toast'

interface CVUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onStartInterview: (cvText: string, parsedCv: ParsedCVProfile) => void
  isStarting?: boolean
}

const SAMPLE_CV_TEXT = `Họ và tên: Nguyễn Văn An
Vị trí ứng tuyển: Kỹ sư Fullstack / Backend Developer
Kinh nghiệm: 2 năm phát triển hệ thống web doanh nghiệp
Trình độ tiếng Nhật: N3 (Giao tiếp tốt trong công việc IT)

KỸ NĂNG CHUYÊN MÔN:
- Ngôn ngữ: Python, TypeScript, JavaScript, SQL
- Frameworks & Thư viện: FastAPI, React 18, Node.js, Next.js, SQLAlchemy
- Cơ sở dữ liệu & Caching: PostgreSQL, Redis, MongoDB
- DevOps & Triển khai: Docker, Docker Compose, Git, CI/CD GitHub Actions, Linux

DỰ ÁN TIÊU BIỂU:
1. Dự án: NexTech E-commerce & Logistics API
- Công nghệ: Python, FastAPI, PostgreSQL, Redis, Docker
- Vai trò: Kỹ sư Backend chính
- Nhiệm vụ: Thiết kế RESTful API xử lý 500+ requests/giây; tích hợp cổng thanh toán trực tuyến.
- Thách thức & Giải pháp: Khắc phục hiện tượng bottleneck truy vấn bằng cách đánh composite index và thiết lập chiến lược Redis Cache-Aside, giảm thời gian phản hồi API từ 420ms xuống 45ms.

2. Dự án: Hệ thống quản lý công việc và báo cáo Ho-Ren-So
- Công nghệ: React, TypeScript, Tailwind CSS, TanStack Query
- Vai trò: Kỹ sư Frontend
- Nhiệm vụ: Xây dựng giao diện Kanban board thời gian thực, quản lý state bất đồng bộ và tối ưu hóa re-render cho 2,000 thẻ công việc.
`

export const CVUploadModal: React.FC<CVUploadModalProps> = ({
  isOpen,
  onClose,
  onStartInterview,
  isStarting = false,
}) => {
  const [activeTab, setActiveTab] = useState<'text' | 'file'>('text')
  const [cvText, setCvText] = useState<string>('')
  const [isParsing, setIsParsing] = useState<boolean>(false)
  const [parsedCv, setParsedCv] = useState<ParsedCVProfile | null>(null)
  const [selectedFileName, setSelectedFileName] = useState<string>('')

  if (!isOpen) return null

  const handleUseSampleCV = () => {
    setCvText(SAMPLE_CV_TEXT)
    handleParseText(SAMPLE_CV_TEXT)
  }

  const handleParseText = async (textToParse?: string) => {
    const text = (textToParse ?? cvText).trim()
    if (!text || text.length < 20) {
      toast.error('Vui lòng nhập nội dung CV chi tiết hơn (ít nhất 20 ký tự).')
      return
    }

    setIsParsing(true)
    try {
      const res = await internshipAPI.parseCVText(text)
      setParsedCv(res.data.parsed_cv)
      toast.success('Đã bóc tách thông tin CV và cấu trúc kỹ thuật thành công!')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Không thể phân tích CV bằng AI.')
    } finally {
      setIsParsing(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setSelectedFileName(file.name)
    setIsParsing(true)
    try {
      const res = await internshipAPI.uploadCVFile(file)
      setCvText(res.data.raw_cv_text)
      setParsedCv(res.data.parsed_cv)
      toast.success(`Đã đọc file ${file.name} và phân tích CV thành công!`)
    } catch (err: any) {
      console.warn('Backend upload error:', err)
      const detail = err.response?.data?.detail || 'Không thể trích xuất nội dung từ file CV. Vui lòng chuyển sang tab "Dán văn bản CV" để nhập trực tiếp.'
      toast.error(detail)
    } finally {
      setIsParsing(false)
    }
  }

  const handleConfirmStart = () => {
    if (!parsedCv || !cvText.trim()) {
      toast.error('Vui lòng phân tích CV trước khi bắt đầu phỏng vấn.')
      return
    }
    onStartInterview(cvText, parsedCv)
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-2xl my-6 rounded-2xl bg-slate-900 border border-slate-700/90 shadow-2xl p-5 sm:p-7 text-white overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <span>Nộp CV & Phỏng vấn Kỹ thuật AI (RAG)</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    RAG Grounded
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  AI sẽ đọc CV của bạn, đưa vào Vector DB và sinh câu hỏi kỹ thuật chuyên sâu theo đúng dự án &amp; tech stack của bạn.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              type="button"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mode Switch & Quick Fill */}
          <div className="py-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/60">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('text')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${activeTab === 'text'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'text-slate-400 hover:text-white'
                  }`}
              >
                Dán văn bản CV
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('file')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${activeTab === 'file'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'text-slate-400 hover:text-white'
                  }`}
              >
                Tải file (.pdf, .docx, .txt)
              </button>
            </div>

            <button
              type="button"
              onClick={handleUseSampleCV}
              disabled={isParsing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-200 text-xs font-semibold transition-all"
            >
              <Zap className="w-3.5 h-3.5 text-indigo-400" />
              <span>Nạp nhanh CV mẫu IT Senior</span>
            </button>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto py-3 space-y-4">
            {activeTab === 'text' ? (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Nội dung CV của bạn (tiếng Việt, Anh hoặc Nhật):</span>
                  <span className="text-[11px] text-slate-500">{cvText.length} ký tự</span>
                </label>
                <textarea
                  value={cvText}
                  onChange={(e) => setCvText(e.target.value)}
                  placeholder="Dán nội dung CV hoặc tóm tắt kinh nghiệm, công nghệ, dự án của bạn vào đây..."
                  rows={6}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700/80 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all font-mono leading-relaxed resize-none"
                />
                {!parsedCv && (
                  <button
                    type="button"
                    onClick={() => handleParseText()}
                    disabled={isParsing || !cvText.trim()}
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs font-bold transition-all disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>{isParsing ? 'Đang đọc và phân tích cấu trúc CV...' : 'Phân tích CV bằng AI'}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300">
                  Chọn file CV từ máy tính:
                </label>
                <div className="border-2 border-dashed border-slate-700 hover:border-amber-400/80 rounded-2xl p-6 text-center bg-slate-950/60 transition-colors">
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,.md"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="cv-file-upload"
                  />
                  <label
                    htmlFor="cv-file-upload"
                    className="cursor-pointer flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-slate-200"
                  >
                    <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-amber-400">
                      <Upload className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-semibold">
                      {selectedFileName ? selectedFileName : 'Nhấp để tải lên PDF, Word DOCX hoặc TXT'}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Tối đa 15MB. Hệ thống sẽ tự động trích xuất chữ và lập chỉ mục RAG.
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* Parsed CV Card Preview */}
            {parsedCv && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl bg-slate-950/90 border border-emerald-500/40 shadow-inner space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-emerald-300">
                      Đã phân tích hồ sơ ứng viên thành công
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    {parsedCv.experience_years}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs border-t border-slate-800/80 pt-2.5">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Ứng viên:</span>
                    <span className="font-bold text-slate-200">{parsedCv.candidate_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Vị trí mục tiêu:</span>
                    <span className="font-bold text-amber-300">{parsedCv.target_role}</span>
                  </div>
                </div>

                {/* Tech Skills Pills */}
                <div>
                  <span className="text-slate-500 block text-[10px] mb-1.5 flex items-center gap-1">
                    <Code2 className="w-3 h-3 text-sky-400" />
                    Kỹ năng kỹ thuật nhận diện:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {parsedCv.technical_skills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[11px] font-mono border border-slate-700"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Projects Identified */}
                {parsedCv.key_projects && parsedCv.key_projects.length > 0 && (
                  <div>
                    <span className="text-slate-500 block text-[10px] mb-1.5 flex items-center gap-1">
                      <Briefcase className="w-3 h-3 text-indigo-400" />
                      Dự án nổi bật sẽ đưa vào phỏng vấn:
                    </span>
                    <div className="space-y-1.5">
                      {parsedCv.key_projects.slice(0, 2).map((proj, pIdx) => (
                        <div
                          key={pIdx}
                          className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                        >
                          <div className="font-bold text-slate-200 flex items-center justify-between">
                            <span>{proj.name}</span>
                            <span className="text-[10px] font-mono text-amber-400">
                              {proj.tech_stack?.slice(0, 3).join(', ')}
                            </span>
                          </div>
                          {proj.challenges_solved && (
                            <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                              💡 Điểm nhấn: {proj.challenges_solved}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isStarting}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-semibold transition-colors"
            >
              Hủy
            </button>

            <button
              type="button"
              onClick={handleConfirmStart}
              disabled={!parsedCv || isStarting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-xs shadow-lg hover:opacity-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <span>{isStarting ? 'Đang tạo câu hỏi & vào phòng...' : 'Vào phòng Phỏng vấn Kỹ thuật ngay'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

export default CVUploadModal
