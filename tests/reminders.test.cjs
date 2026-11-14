const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./loadSource.cjs');

test('local reminders cancel removed/completed tasks and schedule future tasks', async () => {
  const cancelled=[],scheduled=[];
  const future=new Date(Date.now()+3600000).toISOString();
  const notifications={
    setNotificationHandler:()=>{},
    getAllScheduledNotificationsAsync:async()=>[
      {identifier:'study-removed',content:{title:'Old',data:{reminder_at:future}}},
      {identifier:'study-keep',content:{title:'Keep',data:{reminder_at:future}}},
      {identifier:'another-app',content:{}},
    ],
    cancelScheduledNotificationAsync:async id=>cancelled.push(id),
    getPermissionsAsync:async()=>({granted:true}),
    scheduleNotificationAsync:async request=>scheduled.push(request),
    SchedulableTriggerInputTypes:{DATE:'date'},
  };
  const reminders=load('src/data/reminders.js',{'react-native':{Platform:{OS:'android'}},'expo-notifications':notifications});
  await reminders.syncReminders([
    {id:'keep',title:'Keep',reminder_at:future,completed:0},
    {id:'new',title:'New task',module:'IT3133',reminder_at:future,completed:0},
    {id:'finished',title:'Finished',reminder_at:future,completed:1},
    {id:'past',title:'Past',reminder_at:'2020-01-01T12:00:00Z',completed:0},
  ]);
  assert.deepEqual(cancelled,['study-removed']);
  assert.equal(scheduled.length,1);
  assert.equal(scheduled[0].identifier,'study-new');
  assert.equal(scheduled[0].trigger.date.toISOString(),future);
});
