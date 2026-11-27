"""Regrade saved outputs uniformly, then create a reviewable before/after report."""
import argparse
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.services.chat_evaluation import grade,summarize,RUBRIC_VERSION


def regrade(report,cases):
    if report['rubric_version']!=RUBRIC_VERSION:
        report.setdefault('initial_rubric_version',report['rubric_version'])
        report['grading_revision_note']='Saved answers regraded uniformly with the current rubric: explanation language and Japanese translation presence are separate; unintended Chinese variants are checked. No answer regenerated; input files are read-only.'
        for run in report['runs']:
            run.setdefault('initial_summary',run['summary'])
            for row in run['rows']:row['checks']=grade(cases[row['id']],row['answer'],row['sources'],row['error'])
            run['summary']=summarize(run['rows'])
        report['rubric_version']=RUBRIC_VERSION


def fence(text):
    import re
    width=max([3]+[len(m[0]) for m in re.finditer(r'`+',text)])+1
    marker='`'*width
    return marker+'text\n'+text+'\n'+marker


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--baseline',type=Path,required=True);parser.add_argument('--after',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--dataset',type=Path,default=Path(__file__).resolve().parents[1]/'tests/data/chat_quality_cases.json')
    args=parser.parse_args()
    before=json.loads(args.baseline.read_text(encoding='utf-8'));after=json.loads(args.after.read_text(encoding='utf-8'))
    for key in ('dataset_sha256','catalog_sha256'):
        if before[key]!=after[key]:raise SystemExit(f'Cannot compare: {key} differs')
    import hashlib
    if hashlib.sha256(args.dataset.read_bytes()).hexdigest()!=before['dataset_sha256']:raise SystemExit('Dataset changed after generation')
    cases={c['id']:c for c in json.loads(args.dataset.read_text(encoding='utf-8'))['cases']}
    for report in (before,after):
        if not report.get('finished_at'):
            raise SystemExit('Cannot compare: evaluation has not finished')
        for run in report['runs']:
            ids=[row['id'] for row in run['rows']]
            if len(ids)!=len(cases) or set(ids)!=set(cases):
                raise SystemExit('Cannot compare: incomplete or duplicated evaluation cases')
        regrade(report,cases)
    old={(r['mode'],r['model']):r for r in before['runs']}
    lines=['# Báo cáo chất lượng chat — trước và sau','',f'Bộ câu hỏi: {len(cases)} ca; rubric `{RUBRIC_VERSION}`. Cùng checksum bộ câu hỏi và học liệu.',
        '', '**Điểm dưới đây là điểm kiểm tra tự động, không phải độ chính xác tiếng Nhật.** Nội dung dùng từ khóa; cần rà tay ngữ pháp, cách đọc, bản dịch và quan hệ giữa nguồn với nhận định.',
        '', 'Cả hai lượt được chấm bằng cùng rubric từ câu trả lời thô đã lưu; không sinh lại đáp án, không ghi đè JSON đầu vào. Đúng ngôn ngữ giải thích khác với việc có bản dịch Nhật theo yêu cầu.',
        '', '| Chế độ | Điểm trước → sau | Đạt mọi kiểm tra | Đạt từ khóa nội dung | Lỗi xử lý | Trung bình giây trước → sau | p95 giây trước → sau |',
        '| --- | --- | --- | --- | --- | --- | --- |']
    for run in after['runs']:
        prior=old[(run['mode'],run['model'])];a=prior['summary']['overall'];b=run['summary']['overall']
        name=run['model'] or 'Không AI'
        lines.append(f"| {name} | {a['automatic_score']} → {b['automatic_score']} | {a['all_checks_passed']} → {b['all_checks_passed']} / {b['cases']} | {a['content_keyword_passed']} → {b['content_keyword_passed']} / {b['cases']} | {a['errors']} → {b['errors']} | {a['mean_seconds']} → {b['mean_seconds']} | {a['p95_seconds']} → {b['p95_seconds']} |")
    for run in after['runs']:
        prior=old[(run['mode'],run['model'])];name=run['model'] or 'Không AI'
        lines+=['',f"## Theo nhóm — {name}",'','| Nhóm | Điểm trước | Điểm sau |','| --- | --- | --- |']
        for group,stats in run['summary']['groups'].items():lines.append(f"| {group} | {prior['summary']['groups'][group]['automatic_score']} | {stats['automatic_score']} |")
    lines+=['','## Mô hình và giới hạn đo','',f"Mặc định giữ nguyên: `{after['configured_default']}`. Mô hình được Ollama liệt kê khi đo: "+', '.join(f"`{m['name']}`" for m in after['available_models'])+'.',
        '', 'Chỉ có một mô hình sinh văn bản được cài, nên chưa có cơ sở xếp hạng giữa nhiều mô hình. Không tải model mới, không đổi mặc định. `--models available` sẽ đo cùng corpus cho tất cả mô hình sinh văn bản hiện được Ollama liệt kê ở lần chạy sau.',
        '', 'Đây là pipeline kết hợp tra cứu và AI, không phải benchmark mô hình thuần. Tra cứu trực tiếp và từ chối khi thiếu căn cứ làm giảm số lượt gọi model. Thời gian là một lượt đo local, có ảnh hưởng tải máy/cache/khởi động; chưa phải benchmark tải hay SLA. Dữ liệu thử trong SQLite riêng; catalog ứng dụng chỉ đọc.',
        '', 'Các câu không qua tiêu chí được liệt kê dưới đây cùng đáp án tham chiếu kỹ thuật và câu trả lời sau sửa. Mọi ca vẫn cần người biết tiếng Nhật rà; một câu qua từ khóa vẫn có thể sai ngữ nghĩa. Câu trả lời trước sửa nằm trong baseline.json.']
    for run in after['runs']:
        lines+=['',f"## Phiếu rà tay — {run['model'] or 'Không AI'}",'',
            '| Mã ca | Nhóm | Đúng nội dung (đúng/sai/chưa rõ) | Ghi chú người rà |',
            '| --- | --- | --- | --- |']
        for row in run['rows']:
            review=row.get('manual_review',{})
            notes=str(review.get('notes','')).replace('|','\\|').replace('\n',' ')
            lines.append(f"| {row['id']} | {row['group']} | {review.get('correctness','pending')} | {notes} |")
    for run in after['runs']:
        lines+=['',f"## Ca cần rà — {run['model'] or 'Không AI'}"]
        for row in run['rows']:
            if all(row['checks'].values()):continue
            failed=', '.join(key for key,value in row['checks'].items() if not value)
            lines+=['',f"### {row['id']} — {row['group']}",'',row['question'],'',f'Tiêu chí chưa đạt: {failed}.',
                '',f"Tham chiếu (chờ giáo viên rà): {row['reference']}",'',fence(row['answer'] or f"Lỗi: {row['error']}"),
                '', 'Nguồn trả về:',fence(json.dumps(row['sources'],ensure_ascii=False,indent=2))]
    args.output.write_text('\n'.join(lines)+'\n',encoding='utf-8')
    print('Compared identical dataset/catalog snapshots; both phases use '+RUBRIC_VERSION)
