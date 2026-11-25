const globalJobs=globalThis as typeof globalThis&{reminderTimer?:ReturnType<typeof setInterval>};
async function triggerReminderScan(){
  const secret=process.env.CRON_SECRET;if(!secret)return;
  try{await fetch(`${(process.env.INTERNAL_BASE_URL??"http://127.0.0.1:3000").replace(/\/$/,"")}/api/internal/reminders`,{method:"POST",headers:{authorization:`Bearer ${secret}`},signal:AbortSignal.timeout(10000)});}catch{}
}
export async function register(){if(process.env.NEXT_RUNTIME!=="nodejs"||globalJobs.reminderTimer)return;globalJobs.reminderTimer=setInterval(()=>void triggerReminderScan(),15*60*1000);globalJobs.reminderTimer.unref?.();setTimeout(()=>void triggerReminderScan(),30000).unref?.();}
