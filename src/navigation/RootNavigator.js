import StudyTools from '../screens/StudyTools';
import Settings from '../screens/Settings';
import FilePreview from '../screens/FilePreview';
import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {Ionicons} from '@expo/vector-icons';
import Dashboard from '../screens/Dashboard';import Directory from '../screens/Directory';import Filters from '../screens/Filters';import Revision from '../screens/Revision';import Detail from '../screens/Detail';import NoteForm from '../screens/NoteForm';
import {useTheme} from '../theme/styles';
const Stack=createNativeStackNavigator(),Tab=createBottomTabNavigator();
function Tabs(){ const {styles,colors,dark}=useTheme();return <Tab.Navigator screenOptions={({route})=>({headerShown:false,tabBarActiveTintColor:colors.primary,tabBarStyle:{height:65,paddingBottom:8},tabBarIcon:({color,size})=><Ionicons name={{Home:'home-outline',Directory:'library-outline',Filters:'options-outline',Revision:'checkbox-outline',Study:'school-outline'}[route.name]} color={color} size={size}/>})}><Tab.Screen name="Home" component={Dashboard}/><Tab.Screen name="Directory" component={Directory}/><Tab.Screen name="Filters" component={Filters}/><Tab.Screen name="Revision" component={Revision} options={{title:"To Do",tabBarLabel:"To Do"}}/><Tab.Screen name="Study" component={StudyTools} options={{title:"Study tools",tabBarLabel:"Study"}}/></Tab.Navigator>}
export default function RootNavigator(){ const {styles,colors,dark}=useTheme();return <Stack.Navigator screenOptions={{headerTintColor:colors.primary}}><Stack.Screen name="Main" component={Tabs} options={{headerShown:false}}/><Stack.Screen name="Detail" component={Detail} options={{title:'Study Note'}}/><Stack.Screen name="NoteForm" component={NoteForm} options={({route})=>({title:route.params?.id?'Edit Note':'Add Note'})}/><Stack.Screen name="Settings" component={Settings} options={{title:"Settings & backup"}}/><Stack.Screen name="FilePreview" component={FilePreview} options={{title:"File preview"}}/></Stack.Navigator>}
