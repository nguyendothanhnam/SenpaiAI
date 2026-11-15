"""Generate tiny XLSX/JSON/CSV fixtures using only Python's standard library."""
from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZipFile, ZIP_DEFLATED
import json

ROOT = Path(__file__).resolve().parents[1] / "docs" / "samples" / "study"
ROOT.mkdir(parents=True, exist_ok=True)


def xlsx(name, rows):
    contents = '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'
    root_rels = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
    workbook = '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Study" sheetId="1" r:id="rId1"/></sheets></workbook>'
    rels = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'
    row_xml = []
    for number, values in enumerate(rows, 1):
        cells = ''.join(f'<c r="{chr(65 + i)}{number}" t="inlineStr"><is><t xml:space="preserve">{escape(str(value))}</t></is></c>' for i, value in enumerate(values))
        row_xml.append(f'<row r="{number}">{cells}</row>')
    sheet = '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + ''.join(row_xml) + '</sheetData></worksheet>'
    with ZipFile(ROOT / name, 'w', ZIP_DEFLATED) as archive:
        for path, data in [('Content_Types.xml', contents), ('_rels/.rels', root_rels), ('xl/workbook.xml', workbook), ('xl/_rels/workbook.xml.rels', rels), ('xl/worksheets/sheet1.xml', sheet)]:
            archive.writestr('[Content_Types].xml' if path == 'Content_Types.xml' else path, data.encode('utf-8'))


quiz_header = ['question', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer', 'explanation', 'jlpt_level', 'category']
valid_quiz = [quiz_header, ['猫 nghĩa là gì?', 'Chó', 'Mèo', 'Cá', 'Chim', 'B', '猫 là mèo.', 'N5', 'Animals'], ['犬 nghĩa là gì?', 'Chó', 'Mèo', 'Cây', 'Nước', '1', '犬 là chó.', 'N5', 'Animals']]
xlsx('quiz-valid.xlsx', valid_quiz)
xlsx('quiz-invalid-rows.xlsx', [quiz_header, ['', 'A', 'B', 'C', 'D', 'A'], ['Câu sai đáp án', 'A', '', 'C', 'D', 'Z']])
xlsx('quiz-missing-columns.xlsx', [['question', 'answer'], ['猫?', 'Mèo']])
flash_header = ['front', 'back', 'jlpt_level', 'category']
xlsx('flashcard-valid.xlsx', [flash_header, ['猫', 'mèo', 'N5', 'Animals'], ['犬', 'chó', 'N5', 'Animals']])
xlsx('flashcard-invalid-rows.xlsx', [flash_header, ['猫', '', 'N5', 'Animals'], ['', 'chó', 'N5', 'Animals']])
xlsx('flashcard-missing-columns.xlsx', [['front'], ['猫']])
(ROOT / 'quiz-valid.json').write_text(json.dumps({'questions': [{'question': '猫 nghĩa là gì?', 'options': ['Chó', 'Mèo', 'Cá', 'Chim'], 'correct_answer': 'B', 'explanation': '猫 là mèo.', 'jlpt_level': 'N5', 'category': 'Animals'}]}, ensure_ascii=False, indent=2), encoding='utf-8')
(ROOT / 'flashcard-valid.csv').write_text('front,back,jlpt_level,category\n猫,mèo,N5,Animals\n犬,chó,N5,Animals\n', encoding='utf-8')
(ROOT / 'flashcard-valid.json').write_text(json.dumps({'cards': [{'front': '猫', 'back': 'mèo', 'jlpt_level': 'N5', 'category': 'Animals'}]}, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'Generated 6 XLSX files and 3 JSON/CSV files in {ROOT}')
