#!/usr/bin/env python3
"""Isolated CPU comparison. No remote code, paid inference, or training."""
import argparse, collections, gc, hashlib, html, json, os, platform, re, resource, statistics, subprocess, sys, time, unicodedata, zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent

def normalize_input(text):
    text = unicodedata.normalize('NFC', text).translate(str.maketrans('يك', 'یک'))
    return re.sub(r'\s+', ' ', re.sub('[\u064b-\u0652\u0640]', '', text)).strip()

def display(raw, model):
    # Different model phone alphabets. Single pass prevents cascading replacements.
    maps = {'S':'sh','C':'ch','Z':'zh','x':'kh','q':'gh','A':'aa','u':'oo','1':''}
    if model == 'homo': maps.update({'/':'a','@':"'",'a':'aa'})
    return ''.join(maps.get(c,c) for c in raw).strip()

def canonical(text):
    text = unicodedata.normalize('NFC', text).lower()
    for a,b in [('ā','a'),('â','a'),('aa','a'),('oo','u'),('gh','q')]: text=text.replace(a,b)
    return re.sub(r'\s+', ' ', re.sub(r"[^a-z\s]", '', text)).strip()

def distance(a,b):
    row=list(range(len(b)+1))
    for i,x in enumerate(a,1):
        prev=row;row=[i]
        for j,y in enumerate(b,1): row.append(min(row[-1]+1,prev[j]+1,prev[j-1]+(x!=y)))
    return row[-1]

def score(output, references):
    out=canonical(output)
    candidates=[]
    for ref in references:
        target=canonical(ref);words=target.split()
        candidates.append({'reference':ref,'word_edits':distance(words,out.split()),'reference_words':len(words),'character_edits':distance(target,out),'reference_characters':len(target),'exact':out==target})
    return min(candidates,key=lambda r:(r['word_edits']/max(r['reference_words'],1),r['character_edits']))

def digest(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def prepare(name, root):
    from huggingface_hub import HfApi, hf_hub_download
    repo={'homo':'MahtaFetrat/Homo-GE2PE-Persian','negara':'Reza2kn/negara-g2p-clean-v7.1'}[name]
    folder=root/'models'/name;folder.mkdir(parents=True,exist_ok=True)
    receipt=folder/'receipt.json'
    if receipt.exists():
        info=json.loads(receipt.read_text())
        if all((folder/f).exists() and digest(folder/f)==h for f,h in info['sha256'].items()):return folder,info
    rev=HfApi(token=False).model_info(repo,token=False).sha
    def download(file):
        return hf_hub_download(repo,file,revision=rev,token=False,cache_dir=str(root/'hf-cache'))
    wanted=['config.json','generation_config.json','tokenizer_config.json','special_tokens_map.json','added_tokens.json','model.safetensors']
    if name=='homo':
        archive=download('model-weights/homo-ge2pe.zip')
        with zipfile.ZipFile(archive) as z:
            for file in wanted:
                # Extract a fixed allowlist, never optimizer pickle or arbitrary paths.
                with (folder/file).open('wb') as f:f.write(z.read(file))
    else:
        for file in wanted:(folder/file).write_bytes(Path(download(file)).read_bytes())
    info={'repo':repo,'revision':rev,'sha256':{f:digest(folder/f) for f in wanted},'model_bytes':(folder/'model.safetensors').stat().st_size}
    receipt.write_text(json.dumps(info,indent=2));return folder,info

def render(outdir,rows):
    groups=collections.defaultdict(list)
    for r in rows:groups[(r['model'],r['beams'])].append(r)
    summary=[]
    for (model,beams),group in groups.items():
        valid=[r for r in group if 'score' in r and r['category']!='repeat']
        scored=[r for r in valid if r['repeat']==0]
        timings=[r['ms'] for r in valid]
        prior={};consistent=True
        for r in group:
            key=r['persian']
            if 'raw' in r:
                if key in prior and prior[key]!=r['raw']:consistent=False
                prior[key]=r['raw']
        summary.append({'model':model,'beams':beams,'completed':len(group),'errors':sum('error' in r for r in group),'scored_cases':len(scored),'word_error_proxy':sum(r['score']['word_edits'] for r in scored)/max(1,sum(r['score']['reference_words'] for r in scored)),'exact_lines':sum(r['score']['exact'] for r in scored),'median_ms':statistics.median(timings) if timings else None,'p95_ms':sorted(timings)[min(len(timings)-1,int(len(timings)*.95))] if timings else None,'truncated':sum(r.get('truncated',False) for r in group),'repeated_outputs_identical':consistent})
    (outdir/'summary.json').write_text(json.dumps(summary,indent=2))
    parts=['<!doctype html><meta charset="utf-8"><title>Hamava CPU G2P review</title><style>body{background:#101b2d;color:#eee;font:17px system-ui;margin:24px}table{border-collapse:collapse;width:100%}td,th{padding:12px;border-bottom:1px solid #456;text-align:left}pre{white-space:pre-wrap} .bad{background:#482d36}</style><h1>CPU G2P review</h1><p>Automatic spelling-normalized error proxy, not certified pronunciation accuracy or phone performance. Reference and output differences require review.</p><pre>'+html.escape(json.dumps(summary,indent=2))+'</pre><table><tr><th>Case / model</th><th>Persian / reference</th><th>Output / raw phones</th><th>Timing / flags</th></tr>']
    for r in rows:
        if r.get('repeat',0)>0:continue
        sc=r.get('score',{});bad='error' in r or r.get('truncated') or not sc.get('exact')
        cells=[f"{r['id']} / {r['model']} / beam {r['beams']}",r['persian']+'\n'+ ' OR '.join(r['references']),r.get('finglish','')+'\nRAW: '+r.get('raw',r.get('error','')),f"{r.get('ms','?')} ms; word edits {sc.get('word_edits','?')}; truncated={r.get('truncated','?')}"]
        parts.append('<tr'+(' class="bad"' if bad else '')+'>'+''.join('<td><pre>'+html.escape(str(c))+'</pre></td>' for c in cells)+'</tr>')
    (outdir/'review.html').write_text(''.join(parts)+'</table>',encoding='utf-8')
    return summary

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--split',choices=['dev','holdout'],default='dev')
    p.add_argument('--models',nargs='+',choices=['homo','negara'],default=['homo','negara'])
    p.add_argument('--beams',nargs='+',type=int,choices=[1,5],default=[1,5])
    p.add_argument('--threads',type=int,default=2)
    p.add_argument('--repeats',type=int,default=2)
    p.add_argument('--smoke',action='store_true')
    p.add_argument('--list',action='store_true',help='Validate/count cases without installing or running models')
    args=p.parse_args()
    if args.threads<1 or args.repeats<1:p.error('threads and repeats must be positive')
    suite=json.loads((HERE/'suite.json').read_text());cases=[r for r in suite['cases'] if r['split']==args.split]
    if args.smoke:cases=cases[:3]
    assert len({r['id'] for r in suite['cases']})==len(suite['cases'])
    if args.list:
        print(json.dumps({'cases':len(cases),'split':args.split,'calls':len(cases)*len(args.models)*len(args.beams)*args.repeats,'categories':dict(collections.Counter(r['category'] for r in cases))},indent=2));return
    root=HERE.parents[1]/'research-private'/'g2p';root.mkdir(parents=True,exist_ok=True)
    outdir=root/'results'/f"{time.strftime('%Y%m%d-%H%M%S')}-{time.time_ns()%1000000}-{args.split}"
    outdir.mkdir(parents=True);(root/'latest-result.txt').write_text(str(outdir)+'\n')
    print('Results:',outdir,flush=True)
    import torch,transformers
    from transformers import AutoModelForSeq2SeqLM,ByT5Tokenizer
    torch.set_num_threads(args.threads);torch.manual_seed(0)
    torch.use_deterministic_algorithms(True)
    meta={'python':sys.version,'platform':platform.platform(),'processor':platform.processor(),'cpu_count':os.cpu_count(),'torch':torch.__version__,'transformers':transformers.__version__,'args':vars(args),'suite_sha256':digest(HERE/'suite.json'),'preprocessing':'NFC + Arabic ya/kaf normalization + strip diacritics/tatweel + collapse whitespace. No Parsivar, dictionary, or v7.1 overlay. This is not publisher-pipeline parity.','models':{}}
    (outdir/'environment.json').write_text(json.dumps(meta,indent=2))
    (outdir/'packages.txt').write_text(subprocess.check_output([sys.executable,'-m','pip','freeze'],text=True))
    rows=[];failed=False
    try:
        for name in args.models:
            try:
                print(f'Preparing {name} (download on first run only)...',flush=True)
                folder,receipt=prepare(name,root)
                t=time.perf_counter()
                tokenizer=ByT5Tokenizer.from_pretrained(folder,local_files_only=True,extra_special_tokens={})
                model=AutoModelForSeq2SeqLM.from_pretrained(folder,local_files_only=True,use_safetensors=True,trust_remote_code=False).to('cpu').eval()
                meta['models'][name]={**receipt,'load_seconds':time.perf_counter()-t}
                (outdir/'environment.json').write_text(json.dumps(meta,indent=2))
                warm=tokenizer('سلام',return_tensors='pt',add_special_tokens=False)
                with torch.inference_mode():model.generate(**warm,max_new_tokens=32,do_sample=False,num_beams=1)
                for beams in args.beams:
                    for repeat in range(args.repeats):
                        for idx,case in enumerate(cases,1):
                            row={**case,'model':name,'beams':beams,'repeat':repeat}
                            try:
                                normalized=normalize_input(case['persian']);tokens=tokenizer(normalized,return_tensors='pt',add_special_tokens=False,truncation=False)
                                if tokens['input_ids'].shape[1]>512:raise ValueError('Input exceeds 512 bytes/tokens; refusing silent truncation')
                                opts={'max_new_tokens':512,'do_sample':False,'num_beams':beams}
                                if beams>1:opts['early_stopping']=True
                                t=time.perf_counter()
                                with torch.inference_mode():ids=model.generate(**tokens,**opts)
                                ms=round((time.perf_counter()-t)*1000,2)
                                raw=tokenizer.decode(ids[0],skip_special_tokens=True).strip()
                                finglish=display(raw,name)
                                row.update(normalized_input=normalized,input_tokens=tokens['input_ids'].shape[1],output_tokens=len(ids[0])-1,raw=raw,finglish=finglish,ms=ms,truncated=int(ids[0][-1])!=tokenizer.eos_token_id,score=score(finglish,case['references']))
                                print(f'{name} beam={beams} pass={repeat+1} {idx}/{len(cases)} {ms:.0f} ms',flush=True)
                            except Exception as e:row['error']=f'{type(e).__name__}: {e}';failed=True
                            rows.append(row)
                            with (outdir/'results.jsonl').open('a') as f:f.write(json.dumps(row,ensure_ascii=False)+'\n')
                    render(outdir,rows)
                meta['process_peak_rss_mib'] = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / (1024*1024 if sys.platform == 'darwin' else 1024)
                meta['memory_note'] = 'Whole Python process high-water RSS, including framework and previous models; not browser memory or model-only RAM.'
                (outdir/'environment.json').write_text(json.dumps(meta,indent=2))
                del model,tokenizer;gc.collect()
            except Exception as e:
                failed=True;print(f'{name} failed: {type(e).__name__}: {e}',flush=True)
                with (outdir/'errors.txt').open('a') as f:f.write(f'{name}: {type(e).__name__}: {e}\n')
    finally:
        summary=render(outdir,rows)
        print(json.dumps(summary,indent=2));print('Review saved:',outdir/'review.html',flush=True)
        print('Keep this folder. Tell Codex: review my latest CPU benchmark. No need to paste all outputs.')
    if failed:raise SystemExit(1)

if __name__=='__main__':main()
