import React, { useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { useVault } from '../context/VaultContext';
import { useTheme } from '../theme/styles';
import { openAttachment } from '../data/attachments';
import { pdfModule, workerModule } from '../generated/pdfModules';

function pdfHtml(data) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:14px system-ui;background:#eef0f6;margin:0;color:#17213b}nav{position:sticky;top:0;background:white;padding:12px;display:flex;gap:12px;align-items:center;justify-content:center}button{padding:9px 16px;border:1px solid #ccc;border-radius:8px;background:#fff}canvas{display:block;max-width:100%;height:auto;margin:12px auto;background:white}#status{padding:12px;text-align:center}</style></head><body><nav><button id="prev" disabled>Previous</button><span id="page">PDF</span><button id="next" disabled>Next</button></nav><div id="status">Loading PDF…</div><canvas id="canvas"></canvas><script type="module">

  let pdf,page=1,busy=false;const status=document.getElementById('status'),canvas=document.getElementById('canvas');
  async function render(){if(busy)return;busy=true;document.getElementById('prev').disabled=true;document.getElementById('next').disabled=true;try{const p=await pdf.getPage(page);const viewport=p.getViewport({scale:1.4});canvas.width=viewport.width;canvas.height=viewport.height;await p.render({canvasContext:canvas.getContext('2d'),viewport}).promise;document.getElementById('page').textContent=page+' / '+pdf.numPages;status.textContent='';}catch(e){status.textContent='Unable to render PDF: '+e.message;}finally{busy=false;document.getElementById('prev').disabled=page<=1;document.getElementById('next').disabled=page>=pdf.numPages;}}
  document.getElementById('prev').onclick=()=>{if(!busy&&page>1){page--;render();}};document.getElementById('next').onclick=()=>{if(!busy&&page<pdf.numPages){page++;render();}};
  try{const {WorkerMessageHandler}=await import(${JSON.stringify(workerModule)});globalThis.pdfjsWorker={WorkerMessageHandler};const {getDocument}=await import(${JSON.stringify(pdfModule)});const data=Uint8Array.from(atob(${JSON.stringify(data)}),c=>c.charCodeAt(0));pdf=await getDocument({data,isEvalSupported:false,enableXfa:false,useSystemFonts:true}).promise;await render();}catch(e){status.textContent='Unable to preview PDF: '+e.message;}
  </script></body></html>`;
}

export default function FilePreview({ route }) {
  const { notes } = useVault();
  const { styles } = useTheme();
  const [error, setError] = useState('');
  const file = notes.find(note => note.id === route.params.noteId)?.attachments?.[route.params.index];
  if (!file) return <View style={styles.container}><Text style={styles.text}>This file is no longer available.</Text></View>;
  const isImage = /^image\/(png|jpe?g|gif|webp|bmp)$/i.test(file.mimeType);
  const isPdf = file.mimeType === 'application/pdf' || /\.pdf$/i.test(file.name);
  return <View style={styles.screen}>
    <View style={{ padding: 14 }}><Text numberOfLines={1} style={styles.title}>{file.name}</Text><TouchableOpacity onPress={async()=>{try{await openAttachment(file);}catch(e){setError(e.message);}}}><Text style={styles.chipText}>Download / open in another app</Text></TouchableOpacity>{!!error&&<Text style={styles.text}>{error}</Text>}</View>
    {isImage ? <ScrollView contentContainerStyle={{ flexGrow: 1 }}><Image accessibilityLabel={file.name} resizeMode="contain" style={{ width:'100%', minHeight:500, flex:1 }} source={{ uri:`data:${file.mimeType};base64,${file.data}` }}/></ScrollView>
      : isPdf ? Platform.OS === 'web' ? React.createElement('iframe', { title:file.name, srcDoc:pdfHtml(file.data), sandbox:'allow-scripts', style:{width:'100%',flex:1,border:0,minHeight:500} })
        : <WebView originWhitelist={['*']} source={{html:pdfHtml(file.data)}} onShouldStartLoadWithRequest={request=>request.url==='about:blank'||request.url.startsWith('data:')} style={{flex:1}} onError={event=>setError(event.nativeEvent.description)} />
      : <View style={styles.container}><Text style={styles.text}>Use “Download / open in another app” to view this file type.</Text></View>}
  </View>;
}
