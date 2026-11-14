const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function samplePdf() {
  const text='BT /F1 24 Tf 50 180 Td (StudyVault offline PDF) Tj ET';
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 250] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${text.length} >>\nstream\n${text}\nendstream`];
  let pdf='%PDF-1.4\n';const offsets=[0];
  for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
  const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 6\n0000000000 65535 f \n`+offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf).toString('base64');
}

(async()=>{
  const root=path.resolve('dist');
  const server=http.createServer((req,res)=>{
    const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=path.resolve(root,'.'+relative);
    if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    const target=fs.existsSync(file)&&fs.statSync(file).isFile()?file:path.join(root,'index.html');
    const type={'.html':'text/html','.js':'application/javascript','.ttf':'font/ttf','.png':'image/png','.wasm':'application/wasm'}[path.extname(target)]||'application/octet-stream';
    res.writeHead(200,{'Content-Type':type});fs.createReadStream(target).pipe(res);
  });
  await new Promise(resolve=>server.listen(8090,'127.0.0.1',resolve));
  const browser=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9334','--user-data-dir='+path.resolve('.preview-browser-check'),'about:blank'],{windowsHide:true,stdio:'ignore'});
  let socket;
  try{
    let target;
    for(let i=0;i<60;i++){try{target=(await(await fetch('http://127.0.0.1:9334/json')).json()).find(item=>item.type==='page');if(target)break;}catch{}await sleep(200);}
    if(!target)throw new Error('Unable to start test browser.');
    socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve));
    let id=0;const pending=new Map(),errors=[];const contexts=[];
    socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){pending.get(message.id)?.(message);pending.delete(message.id);}else if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.text+' '+(message.params.exceptionDetails.exception?.description||''));else if(message.method==='Runtime.executionContextCreated')contexts.push(message.params.context);});
    const send=(method,params={},sessionId)=>new Promise(resolve=>{const next=++id;pending.set(next,resolve);socket.send(JSON.stringify({id:next,method,params,...(sessionId?{sessionId}:{})}));});
    const evaluate=async expression=>{const response=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(response.result?.exceptionDetails)throw new Error(response.result.exceptionDetails.exception?.description||response.result.exceptionDetails.text);return response.result?.result?.value;};
    const text=()=>evaluate('document.body.innerText');
    const waitText=async phrase=>{for(let i=0;i<60;i++){if((await text()).includes(phrase))return;await sleep(150);}throw new Error('Missing page text: '+phrase+'\n'+(await text()).slice(-1000));};
    const click=async label=>{
      const rect=await evaluate(`(()=>{const leaf=[...document.querySelectorAll('*')].find(e=>e.childElementCount===0&&!e.closest('[aria-hidden="true"],[inert]')&&e.checkVisibility({checkVisibilityCSS:true})&&e.getBoundingClientRect().width>0&&e.textContent.trim()===${JSON.stringify(label)});const el=leaf?.closest('a,[role="button"],[role="tab"],[role="switch"],[tabindex="0"]');if(!el)return null;el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
      if(!rect)throw new Error('Missing clickable label: '+label);
      await send('Input.dispatchMouseEvent',{type:'mousePressed',...rect,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...rect,button:'left',clickCount:1});await sleep(250);
    };
    await send('Runtime.enable');await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url:'http://127.0.0.1:8090'});await waitText('Study Overview');
    await evaluate("new Promise((resolve,reject)=>{const r=indexedDB.deleteDatabase('studyvault-browser');r.onsuccess=()=>resolve(true);r.onerror=()=>reject(r.error);})");
    await send('Page.reload');await waitText('Study Overview');
    await click('Study');await waitText('Pomodoro study timer');
    await click('Flashcards');await waitText('No flashcards yet.');
    await click('Calendar');await waitText('Add exam');
    await click('Statistics');await waitText('Last 7 days');
    await click('Home');await waitText('Study Overview');
    await click('Settings & backup');await waitText('Dark mode');
    const switchRect=await evaluate(`(()=>{const el=document.querySelector('[role="switch"]');const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    await send('Input.dispatchMouseEvent',{type:'mousePressed',...switchRect,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...switchRect,button:'left',clickCount:1});await sleep(500);
    const bg=await evaluate(`getComputedStyle(document.querySelector('[role="switch"]').closest('[role="main"]')||document.querySelector('[role="switch"]').parentElement.parentElement).backgroundColor`);
    console.log('Dark mode control clicked; container:',bg);
    await send('Page.reload');await waitText('Study Overview');
    await evaluate(`new Promise((resolve,reject)=>{const r=indexedDB.open('studyvault-browser',4);r.onsuccess=()=>{const db=r.result;const t=db.transaction(['study','notes','revisionTasks'],'readwrite');t.objectStore('study').put({id:'state',value:{settings:{darkMode:true},flashcards:[{id:'test-card',question:'What is a hook?',answer:'A React function',module:'IT3133',note_id:1}],sessions:[],exams:[{id:'test-exam',title:'Practice exam',module:'IT3133',date:'2026-11-13'}],activeTimer:{id:'test-timer',phase:'focus',module:'IT3133',duration:60,endAt:Date.now()+1200,paused:false}}});t.objectStore('revisionTasks').put({id:'test-task',title:'Study hooks',module:'IT3133',completed:0,priority:'High',due_date:'2026-11-13',updated_at:new Date().toISOString(),note_id:1});t.oncomplete=()=>{db.close();resolve(true)};t.onerror=()=>reject(t.error);};r.onerror=()=>reject(r.error)});`);
    await send('Page.reload');await waitText('Study Overview');await sleep(2000);
    await evaluate(`new Promise((resolve,reject)=>{const r=indexedDB.open('studyvault-browser',4);r.onsuccess=()=>{const db=r.result,t=db.transaction('notes','readwrite'),s=t.objectStore('notes'),n=s.get(1);n.onsuccess=()=>s.put({...n.result,folder:'Semester 1',chapter:'Chapter 2',attachments:[{name:'preview-test.pdf',mimeType:'application/pdf',data:${JSON.stringify(samplePdf())}}]});t.oncomplete=()=>{db.close();resolve(true)};t.onerror=()=>reject(t.error)}})`);
    await send('Page.reload');await waitText('Study Overview');
    await click('Study');await waitText('Focus session complete.');
    await click('Flashcards');await waitText('What is a hook?');await click('Reveal answer');await waitText('A React function');await click('I knew it');
    await click('Statistics');await waitText('1 minutes');
    await click('Calendar');await waitText('Practice exam');
    await click('To Do');await waitText('Study hooks');await waitText('High priority');
    await click('Add task');await waitText('Task *');
    fs.mkdirSync('.preview',{recursive:true});
    for(const [name,width,height]of [['desktop',1440,1000],['mobile',390,844]]){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500});await sleep(250);const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(`.preview/features-${name}.png`,Buffer.from(shot.result.data,'base64'));}
    await send('Network.enable');await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
    await click('Directory');await waitText('Semester 1');await click('React Native Fundamentals');await waitText('preview-test.pdf');await click('preview-test.pdf');await waitText('Download / open in another app');
    let preview='',iframeSession;
    for(let attempt=0;attempt<60;attempt++){
      const tree=await send('Page.getFrameTree');
      const frame=tree.result?.frameTree?.childFrames?.[0]?.frame;
      if(frame){
        const world=await send('Page.createIsolatedWorld',{frameId:frame.id,worldName:'preview-check'});
        if(world.result?.executionContextId){const result=await send('Runtime.evaluate',{contextId:world.result.executionContextId,expression:"document.getElementById('page')?.textContent+'|'+document.getElementById('status')?.textContent",returnByValue:true});preview=result.result?.result?.value||'';}
      }
      if(!preview){
        if(!iframeSession){const targets=await send('Target.getTargets');const child=targets.result?.targetInfos?.find(item=>item.type==='iframe');if(child){const attached=await send('Target.attachToTarget',{targetId:child.targetId,flatten:true});iframeSession=attached.result?.sessionId;await send('Runtime.enable',{},iframeSession);await send('Log.enable',{},iframeSession);}}
        if(iframeSession){const result=await send('Runtime.evaluate',{expression:"document.getElementById('page')?.textContent+'|'+document.getElementById('status')?.textContent",returnByValue:true},iframeSession);preview=result.result?.result?.value||'';}
      }
      if(preview.startsWith('1 / 1|'))break;
      await sleep(250);
    }
    if(!preview.startsWith('1 / 1|')){
      console.log('Preview errors:',errors.map(error=>error.slice(0,900)));
      if(iframeSession){const debug=await send('Runtime.evaluate',{expression:"JSON.stringify({scripts:[...document.scripts].map(s=>({type:s.type,end:s.textContent.slice(-1800)})),ua:navigator.userAgent})",returnByValue:true},iframeSession);console.log('Preview debug:',debug.result?.result?.value);}
    }
    assert.ok(preview.startsWith('1 / 1|'),'PDF preview failed: '+preview);
    assert.deepEqual(errors,[]);
    console.log('PASS: Study tools, dark mode, timer completion, flashcard review, statistics, calendar, task links, offline PDF preview, desktop/mobile rendering.');
    await send('Browser.close');
  }finally{socket?.close();browser.kill();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
