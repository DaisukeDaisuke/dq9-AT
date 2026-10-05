export function parseVideoTimecode(text){
 const value=String(text).trim(),m=/^(\d+):([0-5]\d):([0-5]\d)(?:\.(\d{1,3}))?$/.exec(value);
 if(!m)throw Error('時刻は 2:10:32 のように 時:分:秒 で入力してください');
 const seconds=Number(m[1])*3600+Number(m[2])*60+Number(m[3])+Number('0.'+(m[4]??'0'));
 if(!Number.isFinite(seconds)||seconds<0||seconds>Number.MAX_SAFE_INTEGER/1000)throw Error('時刻が範囲外です');return seconds;
}
export function formatVideoTimecode(seconds){
 if(!Number.isFinite(seconds)||seconds<0)return '';const millis=Math.round(seconds*1000),s=Math.floor(millis/1000);return Math.floor(s/3600)+':'+String(Math.floor(s/60)%60).padStart(2,'0')+':'+String(s%60).padStart(2,'0')+(millis%1000?'.'+String(millis%1000).padStart(3,'0'):'');
}
