import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {Ionicons} from '@expo/vector-icons';
import Dashboard from '../screens/Dashboard';import Directory from '../screens/Directory';import Filters from '../screens/Filters';import Revision from '../screens/Revision';import Detail from '../screens/Detail';import NoteForm from '../screens/NoteForm';
import {colors} from '../theme/styles';
const Stack=createNativeStackNavigator(),Tab=createBottomTabNavigator();
function Tabs(){return <Tab.Navigator screenOptions={({route})=>({headerShown:false,tabBarActiveTintColor:colors.primary,tabBarStyle:{height:65,paddingBottom:8},tabBarIcon:({color,size})=><Ionicons name={{Home:'home-outline',Directory:'library-outline',Filters:'options-outline',Revision:'checkbox-outline'}[route.name]} color={color} size={size}/>})}><Tab.Screen name="Home" component={Dashboard}/><Tab.Screen name="Directory" component={Directory}/><Tab.Screen name="Filters" component={Filters}/><Tab.Screen name="Revision" component={Revision}/></Tab.Navigator>}
export default function RootNavigator(){return <Stack.Navigator screenOptions={{headerTintColor:colors.primary}}><Stack.Screen name="Main" component={Tabs} options={{headerShown:false}}/><Stack.Screen name="Detail" component={Detail} options={{title:'Study Note'}}/><Stack.Screen name="NoteForm" component={NoteForm} options={({route})=>({title:route.params?.id?'Edit Note':'Add Note'})}/></Stack.Navigator>}
