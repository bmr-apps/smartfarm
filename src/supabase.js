import { createClient } from '@supabase/supabase-js';
export const SUPABASE_URL=import.meta.env.VITE_SUPABASE_URL||'https://psupfmarnyxontorftio.supabase.co';
export const PUBLISHABLE_KEY=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_ZPVnQ8t8h3V2dVldhgva9A_Xsp4WI6N';
export const FN_URL=SUPABASE_URL.replace(/\/$/,'')+'/functions/v1/smartfarm-fn';
export const supabase=createClient(SUPABASE_URL,PUBLISHABLE_KEY,{
 db:{schema:'smartfarm'},
 auth:{storageKey:'bmr-app-smartfarm-auth',flowType:'pkce'}
});
