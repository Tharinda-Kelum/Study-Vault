import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVault } from '../context/VaultContext';
import { useTheme } from '../theme/styles';
import { localDate, validDate, uid } from '../data/study';

function Action({ title, onPress, secondary, disabled }) {
  const { styles } = useTheme();
  return <TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={onPress} style={[secondary ? styles.chip : styles.button, disabled && { opacity: .5 }]}><Text style={secondary ? styles.chipText : styles.buttonText}>{title}</Text></TouchableOpacity>;
}

function FocusTimer({ run, busy }) {
  const { studyState, saveStudyState } = useVault();
  const { styles, colors } = useTheme();
  const [minutes, setMinutes] = useState('25');
  const [module, setModule] = useState('');
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const active = studyState.activeTimer;
  const remaining = active ? Math.max(0, Math.ceil(active.paused ? active.remaining : (active.endAt - now) / 1000)) : 25 * 60;
  const start = phase => run(async () => {
    const duration = phase === 'break' ? 5 : Number(minutes);
    if (!Number.isInteger(duration) || duration < 1 || duration > 180) throw new Error('Choose a whole number of minutes from 1 to 180.');
    await saveStudyState(current => ({ ...current, timerNotice: '', activeTimer: { id: uid('session'), phase, duration: duration * 60, module: module.trim().toUpperCase(), endAt: Date.now() + duration * 60000, paused: false } }));
  });
  return <View style={styles.card}>
    <Text style={styles.title}>Pomodoro study timer</Text><Text style={styles.text}>Focus for 25 minutes, then take a 5-minute break. Completed focus sessions count toward your statistics.</Text>
    <Text style={{ fontSize: 60, fontWeight: '800', textAlign: 'center', color: colors.primary, marginVertical: 22 }}>{String(Math.floor(remaining / 60)).padStart(2,'0')}:{String(remaining % 60).padStart(2,'0')}</Text>
    {!!active && <Text style={[styles.text,{textAlign:'center'}]}>{active.phase === 'break' ? 'Break' : 'Focus'} {active.module ? `· ${active.module}` : ''} {active.paused ? '· Paused' : ''}</Text>}
    {!active ? <>
      <Text style={styles.label}>Focus minutes</Text><TextInput accessibilityLabel="Focus minutes" keyboardType="number-pad" value={minutes} onChangeText={setMinutes} style={styles.input}/>
      <Text style={styles.label}>Module (optional)</Text><TextInput accessibilityLabel="Timer module" value={module} onChangeText={setModule} style={styles.input} autoCapitalize="characters" placeholder="e.g. IT3133"/>
      <Action disabled={busy} title="Start focus session" onPress={()=>start('focus')}/><Action disabled={busy} secondary title="Take a 5-minute break" onPress={()=>start('break')}/>
    </> : <>
      <Action disabled={busy} title={active.paused?'Resume':'Pause'} onPress={()=>run(()=>saveStudyState(current=>{
        const timer=current.activeTimer;if(!timer)return current;
        return {...current,activeTimer:timer.paused?{...timer,paused:false,endAt:Date.now()+timer.remaining*1000}:{...timer,paused:true,remaining:Math.max(0,(timer.endAt-Date.now())/1000)}};
      }))}/>
      <Action disabled={busy} secondary title="Discard session" onPress={()=>run(()=>saveStudyState(current=>({...current,activeTimer:null,timerNotice:'Session discarded. No study time was logged.'})))}/>
    </>}
    {!!studyState.timerNotice&&<Text accessibilityLiveRegion="polite" style={styles.text}>{studyState.timerNotice}</Text>}
  </View>;
}

function Flashcards({ run, busy, navigation }) {
  const { notes, studyState, saveStudyState } = useVault();
  const { styles, colors } = useTheme();
  const [adding,setAdding]=useState(false),[question,setQuestion]=useState(''),[answer,setAnswer]=useState(''),[module,setModule]=useState(''),[noteId,setNoteId]=useState(null),[query,setQuery]=useState('');
  const [index,setIndex]=useState(0),[revealed,setRevealed]=useState(false),[filter,setFilter]=useState('All'),[removing,setRemoving]=useState(false);
  const cards=studyState.flashcards.filter(card=>filter==='All'||card.module===filter);
  const card=cards.length?cards[index%cards.length]:null;
  const linked=notes.find(note=>note.id===card?.note_id);
  const add=()=>run(async()=>{
    if(!question.trim()||!answer.trim())throw new Error('Enter both a question and an answer.');
    if(noteId&&!notes.some(note=>note.id===noteId))throw new Error('The selected note no longer exists.');
    const item={id:uid('card'),question:question.trim(),answer:answer.trim(),module:module.trim().toUpperCase(),note_id:noteId,reviewed_at:'',correct:null};
    await saveStudyState(current=>({...current,flashcards:[...current.flashcards,item]}));
    setAdding(false);setQuestion('');setAnswer('');setModule('');setNoteId(null);setQuery('');setRevealed(false);
  });
  const next=()=>{setIndex(current=>current+1);setRevealed(false);setRemoving(false);};
  const review=correct=>run(async()=>{await saveStudyState(current=>({...current,flashcards:current.flashcards.map(item=>item.id===card.id?{...item,correct,reviewed_at:new Date().toISOString()}:item)}));next();});
  return <>
    <View style={styles.row}><Text style={styles.title}>Flashcards</Text><Action secondary disabled={busy} title={adding?'Close form':'+ Add flashcard'} onPress={()=>setAdding(value=>!value)}/></View>
    {adding&&<View style={styles.card}>
      <Text style={styles.label}>Question</Text><TextInput accessibilityLabel="Flashcard question" style={styles.input} multiline value={question} onChangeText={setQuestion}/>
      <Text style={styles.label}>Answer</Text><TextInput accessibilityLabel="Flashcard answer" style={styles.input} multiline value={answer} onChangeText={setAnswer}/>
      <Text style={styles.label}>Module (optional)</Text><TextInput style={styles.input} value={module} onChangeText={setModule} autoCapitalize="characters" placeholder="e.g. IT3133"/>
      <Text style={styles.label}>Link a note (optional)</Text><TextInput accessibilityLabel="Find flashcard note" style={styles.input} value={query} onChangeText={setQuery} placeholder="Search notes..."/>
      {noteId&&<Text style={styles.text}>Linked: {notes.find(note=>note.id===noteId)?.title||'Note removed'}</Text>}
      {!!query.trim()&&notes.filter(note=>`${note.title} ${note.module}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0,8).map(note=><Action secondary key={note.id} title={`${note.title} (${note.module})`} onPress={()=>{setNoteId(note.id);setQuery('');}}/>)}
      {!!noteId&&<Action secondary title="Remove note link" onPress={()=>setNoteId(null)}/>}
      <Action disabled={busy} title="Save flashcard" onPress={add}/>
    </View>}
    <ScrollView horizontal style={{marginVertical:12}}>{['All',...new Set(studyState.flashcards.map(item=>item.module).filter(Boolean))].map(value=><Action secondary key={value} title={filter===value?`✓ ${value}`:value} onPress={()=>{setFilter(value);setIndex(0);setRevealed(false);setRemoving(false);}}/>)}</ScrollView>
    {card?<View style={styles.card}>
      <Text style={styles.text}>Card {index%cards.length+1} of {cards.length} · {card.module||'General'}</Text><Text style={[styles.title,{fontSize:23,lineHeight:32,marginVertical:24}]}>{card.question}</Text>
      {revealed?<View style={{borderTopWidth:1,borderColor:colors.border,paddingTop:16}}><Text style={styles.label}>Answer</Text><Text selectable style={[styles.text,{color:colors.dark,fontSize:17,lineHeight:27}]}>{card.answer}</Text><Action disabled={busy} title="I knew it" onPress={()=>review(true)}/><Action disabled={busy} secondary title="Review again" onPress={()=>review(false)}/></View>:<Action title="Reveal answer" onPress={()=>setRevealed(true)}/>}
      {!!linked&&<Action secondary title={`Open note: ${linked.title}`} onPress={()=>navigation.navigate('Detail',{id:linked.id})}/>}
      <Action secondary title="Next card" onPress={next}/>
      {removing?<><Text style={styles.text}>Delete this flashcard?</Text><Action disabled={busy} secondary title="Confirm delete" onPress={()=>run(async()=>{await saveStudyState(current=>({...current,flashcards:current.flashcards.filter(item=>item.id!==card.id)}));setRemoving(false);setRevealed(false);})}/><Action secondary title="Cancel" onPress={()=>setRemoving(false)}/></>:<Action secondary title="Delete card" onPress={()=>setRemoving(true)}/>}
    </View>:<View style={styles.card}><Text style={styles.text}>No flashcards yet. Add your first question and answer above.</Text></View>}
  </>;
}

function Calendar({ run, busy, navigation }) {
  const { revisionTasks, studyState, saveStudyState } = useVault();
  const { styles, colors } = useTheme();
  const [month,setMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1));
  const [selected,setSelected]=useState(localDate()),[adding,setAdding]=useState(false),[title,setTitle]=useState(''),[module,setModule]=useState(''),[date,setDate]=useState(localDate()),[removing,setRemoving]=useState(null);
  const start=month.getDay(),count=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
  const days=Array.from({length:Math.ceil((start+count)/7)*7},(_,i)=>i>=start&&i<start+count?localDate(new Date(month.getFullYear(),month.getMonth(),i-start+1)):null);
  const tasks=revisionTasks.filter(task=>task.due_date===selected),exams=studyState.exams.filter(exam=>exam.date===selected);
  const marked=new Set([...revisionTasks.map(task=>task.due_date),...studyState.exams.map(exam=>exam.date)]);
  return <>
    <View style={styles.card}><View style={styles.row}><Action secondary title="‹" onPress={()=>setMonth(value=>new Date(value.getFullYear(),value.getMonth()-1,1))}/><Text style={styles.title}>{month.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</Text><Action secondary title="›" onPress={()=>setMonth(value=>new Date(value.getFullYear(),value.getMonth()+1,1))}/></View>
      <View style={{flexDirection:'row'}}>{['S','M','T','W','T','F','S'].map((day,i)=><Text key={i} style={{width:'14.2857%',textAlign:'center',color:colors.muted,paddingVertical:10}}>{day}</Text>)}</View>
      <View style={{flexDirection:'row',flexWrap:'wrap'}}>{days.map((day,i)=><View key={day||`blank-${i}`} style={{width:'14.2857%',padding:2}}>{day&&<TouchableOpacity accessibilityLabel={day} accessibilityState={{selected:day===selected}} onPress={()=>{setSelected(day);setDate(day);}} style={{borderRadius:10,paddingVertical:10,alignItems:'center',backgroundColor:day===selected?colors.primary:colors.bg}}><Text style={{color:day===selected?colors.onPrimary:colors.dark,fontWeight:day===localDate()?'800':'400'}}>{Number(day.slice(-2))}</Text><View style={{width:4,height:4,borderRadius:2,marginTop:4,backgroundColor:marked.has(day)?day===selected?'white':colors.primary:'transparent'}}/></TouchableOpacity>}</View>)}</View>
    </View>
    <Text style={[styles.title,{marginVertical:12}]}>{selected}</Text>
    {tasks.map(task=><View key={task.id} style={styles.card}><Text style={styles.title}>{task.completed?'✓ ':''}{task.title}</Text><Text style={styles.text}>Task · {task.module||'General'} · {task.priority||'Medium'} priority</Text>{!!task.note_id&&<Action secondary title="Open linked note" onPress={()=>navigation.navigate('Detail',{id:task.note_id})}/>}</View>)}
    {exams.map(exam=><View key={exam.id} style={styles.card}><Text style={styles.title}>{exam.title}</Text><Text style={styles.text}>Exam · {exam.module||'General'}</Text><Action secondary disabled={busy} title={removing===exam.id?'Confirm remove exam':'Remove exam'} onPress={()=>removing===exam.id?run(()=>saveStudyState(current=>({...current,exams:current.exams.filter(item=>item.id!==exam.id)}))):setRemoving(exam.id)}/>{removing===exam.id&&<Action secondary title="Cancel" onPress={()=>setRemoving(null)}/>}</View>)}
    {!tasks.length&&!exams.length&&<Text style={[styles.text,{marginBottom:18}]}>No deadlines or exams on this day.</Text>}
    <Action title={adding?'Close exam form':'+ Add exam'} onPress={()=>setAdding(value=>!value)}/>
    {adding&&<View style={styles.card}><Text style={styles.label}>Exam title</Text><TextInput accessibilityLabel="Exam title" style={styles.input} value={title} onChangeText={setTitle}/><Text style={styles.label}>Module (optional)</Text><TextInput style={styles.input} value={module} onChangeText={setModule} autoCapitalize="characters"/><Text style={styles.label}>Date</Text><TextInput accessibilityLabel="Exam date" style={styles.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD"/><Action disabled={busy} title="Save exam" onPress={()=>run(async()=>{if(!title.trim()||!validDate(date))throw new Error('Enter an exam title and a valid date (YYYY-MM-DD).');const exam={id:uid('exam'),title:title.trim(),module:module.trim().toUpperCase(),date};await saveStudyState(current=>({...current,exams:[...current.exams,exam]}));setTitle('');setModule('');setAdding(false);setSelected(date);const parsed=new Date(`${date}T12:00:00`);setMonth(new Date(parsed.getFullYear(),parsed.getMonth(),1));})}/></View>}
  </>;
}

function Statistics() {
  const { studyState, revisionTasks } = useVault();
  const { styles, colors } = useTheme();
  const days=Array.from({length:7},(_,i)=>{const day=new Date();day.setDate(day.getDate()-(6-i));return localDate(day);});
  const rows=days.map(day=>({day,minutes:Math.round(studyState.sessions.filter(session=>localDate(new Date(session.finished_at))===day).reduce((sum,item)=>sum+item.seconds,0)/60),tasks:revisionTasks.filter(task=>task.completed&&task.completed_at&&localDate(new Date(task.completed_at))===day).length}));
  const max=Math.max(1,...rows.map(row=>row.minutes));
  const modules=[...new Set(studyState.sessions.map(session=>session.module||'General'))];
  return <>
    <View style={styles.card}><Text style={styles.title}>Last 7 days</Text><Text style={[styles.heading,{marginTop:16}]}>{rows.reduce((sum,row)=>sum+row.minutes,0)} minutes</Text><Text style={styles.text}>{rows.reduce((sum,row)=>sum+row.tasks,0)} tasks completed · {studyState.flashcards.filter(card=>card.reviewed_at&&days.includes(localDate(new Date(card.reviewed_at)))).length} cards reviewed</Text></View>
    <View style={styles.card}>{rows.map(row=><View key={row.day} style={{marginBottom:16}}><View style={styles.row}><Text style={styles.text}>{row.day.slice(5)}</Text><Text style={styles.text}>{row.minutes} min · {row.tasks} tasks</Text></View><View style={{height:8,backgroundColor:colors.border,borderRadius:8,marginTop:6}}><View style={{height:8,width:`${row.minutes/max*100}%`,backgroundColor:colors.primary,borderRadius:8}}/></View></View>)}</View>
    <View style={styles.card}><Text style={styles.title}>Study time by module · all time</Text>{modules.map(module=><View key={module} style={styles.row}><Text style={styles.text}>{module}</Text><Text style={styles.text}>{Math.round(studyState.sessions.filter(session=>(session.module||'General')===module).reduce((sum,item)=>sum+item.seconds,0)/60)} min</Text></View>)}{!modules.length&&<Text style={styles.text}>Complete a focus session to start tracking your study time.</Text>}</View>
  </>;
}

export default function StudyTools({ navigation }) {
  const { styles, colors } = useTheme();
  const [tab,setTab]=useState('Timer'),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const run=async action=>{if(busy)return;setBusy(true);setError('');try{await action();}catch(e){setError(e.message||'Unable to save. Please try again.');}finally{setBusy(false);}};
  return <ScrollView style={styles.screen} contentContainerStyle={[styles.container,{width:'100%',maxWidth:900,alignSelf:'center'}]} keyboardShouldPersistTaps="handled">
    <View style={styles.row}><Text style={styles.heading}>Study tools</Text><TouchableOpacity accessibilityLabel="Settings and backup" onPress={()=>navigation.navigate('Settings')} style={{padding:12}}><Ionicons name="settings-outline" size={24} color={colors.primary}/></TouchableOpacity></View>
    <Text style={styles.sub}>Focus, practise, and plan your next study session.</Text>
    <ScrollView horizontal style={{marginBottom:16}}>{['Timer','Flashcards','Calendar','Statistics'].map(value=><Action secondary key={value} title={tab===value?`✓ ${value}`:value} onPress={()=>{setTab(value);setError('');}}/>)}</ScrollView>
    {!!error&&<Text accessibilityRole="alert" style={{color:colors.danger,marginBottom:14}}>{error}</Text>}
    {tab==='Timer'?<FocusTimer run={run} busy={busy}/>:tab==='Flashcards'?<Flashcards run={run} busy={busy} navigation={navigation}/>:tab==='Calendar'?<Calendar run={run} busy={busy} navigation={navigation}/>:<Statistics/>}
  </ScrollView>;
}
