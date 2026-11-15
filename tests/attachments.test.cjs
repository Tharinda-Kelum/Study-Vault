const {test}=require('node:test');
const assert=require('node:assert/strict');
const load=require('./loadSource.cjs');
test('Android PDF import uses File API and preserves bytes',async()=>{
const uri='content://com.android.providers.downloads.documents/document/42';
const data=Buffer.from([37,80,68,70,0,255]).toString('base64');
let result={canceled:false,assets:[{uri,name:'lecture.pdf',mimeType:'application/pdf',size:6}]};
let reads=0;
const api=load('src/data/attachments.js',{
'react-native':{Platform:{OS:'android'}},
'expo-document-picker':{getDocumentAsync:async options=>{assert.equal(options.copyToCacheDirectory,false);return result;}},
'expo-file-system':{File:class{constructor(path){assert.equal(path,uri);}async base64(){reads++;return data;}}},
'expo-file-system/legacy':{readAsStringAsync:()=>{throw Error('Legacy read');}},
'expo-sharing':{}
});
assert.deepEqual(await api.pickAttachments(),[{name:'lecture.pdf',mimeType:'application/pdf',size:6,data}]);
result={canceled:true};
assert.deepEqual(await api.pickAttachments(),[]);
result={canceled:false,assets:[{uri,size:21*1024*1024}]};
await assert.rejects(api.pickAttachments(),/smaller than 20 MB/);
assert.equal(reads,1);
});
