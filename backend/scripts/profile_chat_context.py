"""Opt-in local hardware experiment; never changes app defaults or pulls models."""
import argparse
import json
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.core.config import settings


def request(path, payload=None):
    raw=json.dumps(payload).encode() if payload is not None else None
    req=urllib.request.Request(settings.ollama_base_url.rstrip('/')+path,data=raw,
                               headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=180) as response:return json.load(response)


def physical_memory():
    try:
        import ctypes
        class Status(ctypes.Structure):
            _fields_=[('length',ctypes.c_ulong),('load',ctypes.c_ulong),*[(k,ctypes.c_ulonglong)for k in ('total','available','page','available_page','virtual','available_virtual','extended')]]
        value=Status();value.length=ctypes.sizeof(value)
        if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(value)):
            return {'physical_total_bytes':value.total,'physical_available_bytes':value.available}
    except Exception:pass
    return {'unavailable':True}


def profile():
    models=request('/api/tags').get('models',[])
    report={'default_unchanged':settings.ollama_model,'hardware':physical_memory(),'measurements':[],
            'limits':'Two controlled prompt repetitions per setting; local warm/cold and concurrent machine load affect time. Ollama resident allocation is not peak process RSS.'}
    # Fixed generic evidence, not a memorized question/answer pair.
    evidence=('Dictionary-form verb + ことができる expresses ability. Negative: ことができない. '
              'Example: 日本語を話すことができます。 Reading: にほんごをはなすことができます。 Meaning: I can speak Japanese.\n')*15
    for model in models:
        if model.get('capabilities') and 'completion' not in model['capabilities']:continue
        for context,output in ((2048,350),(4096,640),(8192,640)):
            for iteration in range(2):
                start=time.perf_counter();before=physical_memory()
                try:
                    result=request('/api/chat',{'model':model['name'],'stream':False,'messages':[
                        {'role':'system','content':'You are a Japanese tutor. Explain only the supplied evidence in Vietnamese. Include one reading and translated example. Keep under 90 words.'},
                        {'role':'user','content':evidence+'\nExplain the potential form in this evidence.'}],
                        'options':{'num_ctx':context,'num_predict':output,'temperature':0,'num_thread':6}})
                    report['measurements'].append({'model':model['name'],'context':context,'output_limit':output,
                        'iteration':iteration,'seconds':round(time.perf_counter()-start,3),'memory_before':before,
                        'memory_after':physical_memory(),'resident':request('/api/ps').get('models',[]),
                        **{k:result.get(k) for k in ('prompt_eval_count','eval_count','done_reason','load_duration','total_duration')},
                        'answer':result.get('message',{}).get('content','')})
                except Exception as exc:
                    report['measurements'].append({'model':model['name'],'context':context,'error':type(exc).__name__})
    return report


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args();data=profile()
    args.output.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('Measured configurations:',len(data['measurements']),'default unchanged:',data['default_unchanged'])
