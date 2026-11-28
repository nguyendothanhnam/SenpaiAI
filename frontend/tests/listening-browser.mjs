// Run Vite on 5188 and a separate headless Chrome with --remote-debugging-port=9274
// at /tests/fixtures/listening-review.html, then: node tests/listening-browser.mjs
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
const artifacts=new URL('../../tmp/listening-ui-review/',import.meta.url);await mkdir(artifacts,{recursive:true})
const pages=await fetch(`http://127.0.0.1:${process.env.LISTENING_CDP_PORT||9274}/json`).then(response=>response.json())
const page=pages.find(item=>item.url.includes('/tests/fixtures/listening-review.html'))
assert.ok(page,'Open the listening review fixture in the isolated Chrome profile first')
const socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}))
let id=0;const waiting=new Map()
socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){waiting.get(data.id)?.(data);waiting.delete(data.id)}})
const call=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;waiting.set(key,data=>data.error?reject(data.error):resolve(data.result));socket.send(JSON.stringify({id:key,method,params}))})
const js=async expression=>{const data=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(data.exceptionDetails)throw Error(data.exceptionDetails.exception?.description||JSON.stringify(data.exceptionDetails));return data.result.value}
const wait=expression=>js(`(async()=>{for(let n=0;n<100;n++){if(${expression})return true;await new Promise(r=>setTimeout(r,80))}throw Error('Timed out: '+${JSON.stringify(expression)})})()`)
const tap=label=>js(`(()=>{const node=[...document.querySelectorAll('button')].find(n=>n.offsetParent!==null&&n.textContent.trim()===${JSON.stringify(label)});if(!node)throw Error('Button missing: '+${JSON.stringify(label)});if(node.disabled)throw Error('Button disabled: '+${JSON.stringify(label)});node.click()})()`)
const input=(selector,value)=>js(`(()=>{const node=document.querySelector(${JSON.stringify(selector)});if(!node)throw Error('Missing field: '+${JSON.stringify(selector)});const prototype=node instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:node instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(node,${JSON.stringify(value)});node.dispatchEvent(new Event(node instanceof HTMLSelectElement?'change':'input',{bubbles:true}))})()`)
const shot=async name=>{const capture=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(new URL(name+'.png',artifacts),Buffer.from(capture.data,'base64'))}
const checks=[]
try{
 await call('Page.enable');await call('Page.reload');await new Promise(resolve=>setTimeout(resolve,800))
 await wait(`window.go && document.querySelector('h1') && document.querySelectorAll('.listening-action[href]').length`)
 await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
 await tap('N5');await wait(`document.querySelector('.listening-level.is-active')?.textContent==='N5'`)
 await tap('Tạo bài nghe mới')
 await wait(`!document.getElementById('listening-create-panel').hidden`)
 for(const theme of ['classic','than-khe','sakura'])for(const mode of ['light','dark'])for(const width of [1440,768,320]){
  await call('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:width<500})
  const language=width===768?'en':'vi'
  const result=await js(`(async()=>{
   window.theme('${theme}','${mode}');await window.language('${language}');await new Promise(r=>setTimeout(r,100));
   if(document.documentElement.scrollWidth>innerWidth)throw Error('Horizontal overflow '+document.documentElement.scrollWidth+' at ${width}px');
   const canvas=document.createElement('canvas');canvas.width=1;canvas.height=1;const context=canvas.getContext('2d');const rgb=color=>{context.clearRect(0,0,1,1);context.fillStyle=color;context.fillRect(0,0,1,1);return [...context.getImageData(0,0,1,1).data].slice(0,3)};
   const luminance=values=>values.map(value=>{value/=255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4}).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
   const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
   const action=document.querySelector('a.listening-action');const style=getComputedStyle(action);const stops=style.backgroundImage.match(/color\\([^)]*\\)|rgba?\\([^)]*\\)|#[0-9a-fA-F]{3,8}/g)||[];
   const contrast=Math.min(...stops.map(stop=>ratio(rgb(style.color),rgb(stop))));if(!stops.length||contrast<4.5)throw Error('CTA contrast '+contrast+' '+style.backgroundImage);
   if(action.getBoundingClientRect().height<44)throw Error('Small action target');
   if(document.querySelector('input[type=file]').offsetParent!==null)throw Error('Native file input visible');
   if(document.body.innerText.includes('listening.ui.'))throw Error('Missing translations');
   const grid=document.querySelector('.listening-module > .grid');const columns=getComputedStyle(grid).gridTemplateColumns.split(' ').length;if(columns!==(${width}>=768?2:1))throw Error('Wrong lesson grid columns');
   return {theme:'${theme}',mode:'${mode}',width:${width},language:'${language}',contrast:Math.round(contrast*100)/100};
  })()`)
  checks.push(result)
  if(theme==='classic'&&[1440,320].includes(width))await shot(`${theme}-${mode}-${width}-creator`)
 }
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false})
 await js(`window.theme('classic','light');window.language('vi')`)
 // Native picker and drag/drop share the existing readFile checks.
 for(const expression of [`new File(['bad'],'subtitles.txt',{type:'text/plain'})`,`new File([new Uint8Array(1048577)],'too-large.srt')`,`new File([new Uint8Array([255])],'invalid-utf8.srt')`]){
  await js(`(()=>{const transfer=new DataTransfer();transfer.items.add(${expression});document.querySelector('.listening-dropzone').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}))})()`)
  await wait(`document.querySelector('#listening-panel-video [role=alert]')`)
  assert.equal(await js(`document.querySelector('#listening-panel-video .listening-action').disabled`),true)
 }
 const subtitles='1\n00:00:00,000 --> 00:00:02,000\n今日はいい天気ですね。\n\n2\n00:00:02,000 --> 00:00:04,000\n公園へ行きましょう。'
 await input('#listening-panel-video input[placeholder]', 'https://www.youtube.com/watch?v=M7lc1UVf-VE')
 await js(`(()=>{const transfer=new DataTransfer();transfer.items.add(new File([${JSON.stringify(subtitles)}],'lesson.srt'));document.querySelector('.listening-dropzone').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}))})()`)
 await wait(`document.querySelector('#listening-panel-video textarea').value.length>0 && document.querySelector('#listening-panel-video').innerText.includes('lesson.srt')`)
 const beforeSwitch=await js(`document.querySelector('#listening-panel-video textarea').value`)
 await tap('Từ tài liệu Library');await tap('Từ Video YouTube & Phụ đề')
 assert.equal(await js(`document.querySelector('#listening-panel-video textarea').value`),beforeSwitch)
 await tap('Phân tích và xem trước');await wait(`document.querySelectorAll('#listening-panel-video input[type=number]').length===4`)
 assert.equal(await js(`window.fixtureCalls.filter(call=>call.url==='/listening/video/parse').at(-1).body.subtitles`),beforeSwitch)
 await tap('Gộp với câu sau');await wait(`document.querySelectorAll('#listening-panel-video input[type=number]').length===2`)
 await tap('Tách tại giữa câu');await wait(`document.querySelectorAll('#listening-panel-video input[type=number]').length===4`)
 await input('#listening-panel-video input[maxlength="200"]','Bài nghe kiểm thử video')
 await input('#listening-panel-video input[maxlength="80"]','doi_song')
 await js(`(()=>{const button=[...document.querySelectorAll('#listening-panel-video button')].find(n=>n.textContent==='Lưu bài nghe riêng tư');button.click();button.click()})()`)
 await wait(`[...document.querySelectorAll('#listening-panel-video [role=status]')].some(node=>node.innerText.includes('Đã lưu'))`)
 assert.equal(await js(`window.fixtureCalls.filter(call=>call.url==='/listening/video/lessons').length`),1)
 const saved=await js(`window.fixtureCalls.find(call=>call.url==='/listening/video/lessons').body`)
 assert.equal(saved.title,'Bài nghe kiểm thử video');assert.equal(saved.segments.length,2);assert.equal(saved.segments[0].start_ms,0);assert.equal(saved.segments[1].end_ms,4000)
 checks.push({interaction:'video drag/drop validation, draft retention, parse/merge/split/save payload and duplicate save lock',pass:true})
 await tap('Từ tài liệu Library');await wait(`document.querySelector('#listening-panel-library select').options.length>1`)
 await input('#listening-panel-library input[placeholder]','đời sống')
 await wait(`document.querySelector('#listening-panel-library select option[value="91"]')`)
 await input('#listening-panel-library select','91')
 await wait(`document.querySelector('#listening-panel-library').innerText.includes('週末の予定')`)
 await shot('classic-light-library')
 await tap('Tạo bản nháp');await wait(`document.querySelectorAll('#listening-panel-library textarea').length===6`)
 await input('#listening-panel-library input:not([placeholder])','Bài nghe từ thư viện đã sửa')
 await tap('Từ Video YouTube & Phụ đề');await tap('Từ tài liệu Library')
 assert.equal(await js(`document.querySelector('#listening-panel-library input:not([placeholder])').value`),'Bài nghe từ thư viện đã sửa')
 await tap('Lưu bài nghe');await wait(`document.getElementById('listening-create-panel').hidden`)
 const library=await js(`window.fixtureCalls.find(call=>call.url==='/listening/lessons/from-library/save').body`)
 assert.equal(library.document_id,91);assert.equal(library.title,'Bài nghe từ thư viện đã sửa');assert.equal(library.segments.length,3)
 checks.push({interaction:'Library title filter, document preview, draft/edit retention and original save payload',pass:true})
 await tap('Tất cả');await wait(`window.fixtureCalls.filter(call=>call.url==='/listening/lessons').at(-1).params.jlpt_level===undefined`)
 await tap('Tiếp');await wait(`window.fixtureCalls.filter(call=>call.url==='/listening/lessons').at(-1).params.offset===12`)
 await tap('N3');await wait(`window.fixtureCalls.filter(call=>call.url==='/listening/lessons').at(-1).params.offset===0 && window.fixtureCalls.filter(call=>call.url==='/listening/lessons').at(-1).params.jlpt_level==='N3'`)
 assert.equal(await js(`window.fixtureCalls.some(call=>call.url.endsWith('/audio'))`),false,'Lesson cards must not generate TTS')
 checks.push({interaction:'JLPT filtering and pagination retain server parameters; cards never fetch audio',pass:true})
 await js(`window.go('/listening/1')`);await wait(`document.querySelector('audio')?.readyState>=1`)
 await wait(`document.querySelectorAll('.listening-transcript-row').length===3`)
 await tap('あ Furigana');assert.equal(await js(`document.querySelectorAll('.listening-transcript-row ruby').length`),0)
 await tap('あ Furigana');assert.ok(await js(`document.querySelectorAll('.listening-transcript-row ruby').length`)>0)
 await tap('文 Dịch tiếng Việt');assert.equal(await js(`[...document.querySelectorAll('.listening-transcript-row p')].some(n=>n.textContent.includes('Hôm nay trời đẹp'))`),false)
 await tap('文 Dịch tiếng Việt')
 await input('input[type=range]',2.25);await wait(`document.querySelectorAll('.listening-transcript-row')[1].getAttribute('aria-current')==='true'`)
 await js(`document.querySelector('.listening-replay').click()`);await wait(`document.querySelector('audio').paused===false`)
 await shot('classic-light-audio-player')
 await js(`document.querySelector('button[aria-label="Tạm dừng"]').click()`);await wait(`document.querySelector('audio').paused`)
 checks.push({interaction:'Audio source loads, scrubber/highlight, furigana/translation toggles and sentence replay work',pass:true})
 await js(`window.go('/listening/2')`);await wait(`document.querySelector('.listening-player-frame iframe') && document.querySelector('button[aria-label="Phát"]')?.disabled===false`)
 await js(`document.querySelector('button[aria-label="Phát"]').click()`);await wait(`document.querySelector('button[aria-label="Tạm dừng"]')`)
 await input('select',1.25);await wait(`window.youtubeCalls.some(call=>call[0]==='rate'&&call[1]===1.25)`)
 await input('input[type=range]',2.5);await wait(`window.youtubeCalls.some(call=>call[0]==='seek'&&call[1]===2.5)`)
 await js(`document.querySelectorAll('.listening-replay')[2].click()`);await wait(`window.youtubeCalls.some(call=>call[0]==='seek'&&call[1]===4)`)
 assert.equal(await js(`window.fixtureCalls.some(call=>call.url==='/listening/lessons/2/audio')`),false)
 await tap('Bài tập luyện nghe');assert.equal(await js(`document.querySelector('.listening-transcript-row')===null`),true)
 await tap('Nghe và đọc')
 await shot('classic-light-video-player')
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:1100,deviceScaleFactor:1,mobile:true})
 await js(`window.theme('classic','dark');window.language('en')`);await wait(`document.querySelector('h2')?.textContent`)
 assert.equal(await js(`document.documentElement.scrollWidth<=innerWidth`),true)
 await shot('classic-dark-mobile-video-player')
 await js(`window.go('/listening')`);await wait(`window.youtubeCalls.some(call=>call[0]==='destroy')`)
 checks.push({interaction:'YouTube existing play/pause/rate/seek/cleanup plus transcript/exercise controls',pass:true})
 await writeFile(new URL('results.json',artifacts),JSON.stringify(checks,null,2))
 console.log(JSON.stringify({responsiveCases:18,interactionGroups:checks.filter(item=>item.interaction).length,minCTAContrast:Math.min(...checks.filter(item=>item.contrast).map(item=>item.contrast)),artifacts:artifacts.pathname},null,2))
}catch(error){await shot('failure');throw error}finally{socket.close()}
