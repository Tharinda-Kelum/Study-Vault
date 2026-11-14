import React, { useState } from 'react';
import { View, Text, TextInput, FlatList, ScrollView, TouchableOpacity } from 'react-native';
import { useVault } from '../context/VaultContext';
import NoteCard from '../components/NoteCard';
import { useTheme } from '../theme/styles';

export default function Directory({ navigation }) {
  const { notes } = useVault();
  const { styles, colors } = useTheme();
  const [query,setQuery]=useState(''),[folder,setFolder]=useState('All'),[chapter,setChapter]=useState('All');
  const folders=['All',...new Set(notes.map(note=>note.folder||'Unfiled'))];
  const chapters=['All',...new Set(notes.filter(note=>folder==='All'||(note.folder||'Unfiled')===folder).map(note=>note.chapter).filter(Boolean))];
  const filtered=notes.filter(note=>(folder==='All'||(note.folder||'Unfiled')===folder)&&(chapter==='All'||note.chapter===chapter)&&[note.title,note.module,note.category,note.tags,note.content,note.code,note.output,note.folder,note.chapter].some(value=>(value||'').toLowerCase().includes(query.trim().toLowerCase())));
  const chips=(values,current,onChange)=><ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:10}}>{values.map(value=><TouchableOpacity key={value} onPress={()=>onChange(value)} style={[styles.chip,current===value&&{backgroundColor:colors.primary}]}><Text style={[styles.chipText,current===value&&{color:colors.onPrimary}]}>{value}</Text></TouchableOpacity>)}</ScrollView>;
  return <View style={styles.screen}><FlatList contentContainerStyle={[styles.container,{width:'100%',maxWidth:1000,alignSelf:'center'}]} data={filtered} keyExtractor={note=>String(note.id)} ListHeaderComponent={<>
    <Text style={styles.heading}>Note directory</Text><Text style={styles.sub}>Your modules, folders and chapters in one place.</Text>
    <TextInput accessibilityLabel="Search notes" style={styles.input} value={query} onChangeText={setQuery} placeholder="Search notes, folders or chapters..."/>
    <Text style={styles.label}>Folders</Text>{chips(folders,folder,value=>{setFolder(value);setChapter('All');})}
    {chapters.length>1&&<><Text style={styles.label}>Chapters</Text>{chips(chapters,chapter,setChapter)}</>}
    <TouchableOpacity style={styles.button} onPress={()=>navigation.navigate('NoteForm')}><Text style={styles.buttonText}>+ Add Note</Text></TouchableOpacity>
    <Text style={[styles.text,{marginBottom:14}]}>{filtered.length} notes</Text>
  </>} renderItem={({item})=><NoteCard note={item} onPress={()=>navigation.navigate('Detail',{id:item.id})}/>} ListEmptyComponent={<Text style={styles.empty}>No matching notes. Add a note or try another search.</Text>}/></View>;
}
