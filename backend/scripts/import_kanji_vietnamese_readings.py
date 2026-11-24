"""Extract only existing dictionary characters from pinned Unicode Unihan 17."""
import argparse,json,zipfile,urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
URL='https://www.unicode.org/Public/17.0.0/ucd/Unihan.zip'
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--download',action='store_true');args=parser.parse_args()
    archive=ROOT.parent/'tmp/Unihan-17.zip'
    if args.download:
        urllib.request.urlretrieve(URL,archive)
        urllib.request.urlretrieve('https://www.unicode.org/license.txt',ROOT/'app/data/UNICODE_LICENSE.txt')
    characters={row['kanji'] for row in json.loads((ROOT/'app/data/kanji_dictionary.json').read_text(encoding='utf-8'))}
    entries={}
    with zipfile.ZipFile(archive) as file:
        for line in file.read('Unihan_Readings.txt').decode('utf-8').splitlines():
            if not line or line.startswith('#'):continue
            code,property,value=line.split('\t',2)
            key=chr(int(code[2:],16))
            if property=='kVietnamese' and key in characters:entries[key]=value.upper()
    # The requested reference screenshot explicitly supplies this reading.
    overrides={'際':'TẾ'}
    entries.update(overrides)
    result={'version':'17.0.0','source':'Unicode Unihan kVietnamese','source_url':URL,'license':'Unicode-3.0','user_reference_overrides':overrides,
            'copyright':'Copyright Unicode, Inc. and others. See UNICODE_LICENSE.txt.','entries':entries}
    (ROOT/'app/data/kanji_vietnamese_readings.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'Extracted {len(entries)}/{len(characters)} Vietnamese readings; missing readings remain unknown.')
