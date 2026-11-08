export type Kind = 'teams' | 'adjudicators';
export type Row = Record<string,string>;
export const norm=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
export function target(input:string){
 const u=new URL(input); const host=u.hostname;
 if(u.protocol!=='https:'||u.username||u.password||u.port||!host.includes('.')||host==='localhost'||/^[\d.]+$/.test(host)||host.includes(':')||/\.(local|internal|localhost)$/.test(host))throw Error('Enter a public HTTPS Tabbycat tournament URL.');
 const parts=u.pathname.split('/').filter(Boolean); const slug=parts[0]==='api'?parts[3]:parts[0];
 if(!slug||!/^[-\w]+$/.test(slug))throw Error('The tournament slug is missing or invalid.');
 return {origin:u.origin,slug,base:`${u.origin}/api/v1/tournaments/${slug}/`};
}
export function csv(text:string){
 if(text.length>2000000)throw Error('CSV exceeds 2 MB.');
 const table:string[][]=[]; let row:string[]=[],cell='',quote=false;
 text=text.replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quote&&text[i+1]==='"'){cell+='"';i++;}else quote=!quote;}else if(c===','&&!quote){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quote){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))table.push(row);row=[];cell='';}else cell+=c;}
 if(quote)throw Error('CSV contains an unclosed quote.');row.push(cell);if(row.some(x=>x.trim()))table.push(row);
 const headers=table.shift()?.map(x=>x.trim())??[];
 if(!headers.length||new Set(headers).size!==headers.length||headers.some(x=>!x))throw Error('Use unique, non-empty column headers.');
 if(table.length>2000)throw Error('Maximum 2,000 rows per sheet.');
 return {headers,rows:table.map(r=>Object.fromEntries(headers.map((h,i)=>[h,(r[i]??'').trim()]))) as Row[]};
}
export function fields(kind:Kind){return kind==='teams'?['team_name','institution_code',...Array.from({length:3},(_,i)=>['name','email','phone','gender'].map(f=>`speaker${i+1}_${f}`)).flat()]:['name','email','phone','gender','institution_code','base_score','independent','adj_core'];}
export function autoMap(headers:string[],kind:Kind){const aliases:Record<string,string[]>={team_name:['reference','team','teamname','teamreference'],name:['fullname','adjudicatorname','adjname'],institution_code:['code','institutioncode','inscode','institution','institutionshortcode'],base_score:['score','basescore'],adj_core:['adjcore','core']};const map:Record<string,string>={};for(const f of fields(kind)){const options=[norm(f),...(aliases[f]??[])];const m=f.match(/^speaker(\d)_(\w+)$/);if(m){options.push(`member${m[1]}${m[2]}`,`debater${m[1]}${m[2]}`,`${m[2]}${m[1]}`);if(m[2]==='name')options.push(`member${m[1]}`,`speaker${m[1]}`,`debater${m[1]}`);}map[f]=headers.find(h=>options.includes(norm(h)))??'';}return map;}
export const nameKey=(s:string)=>s.trim().toLowerCase().replace(/\s+/g,' ');
function gender(s:string){const v=s.toLowerCase().trim();if(!v)return 'O';const g:Record<string,string>={m:'M',male:'M',man:'M',f:'F',female:'F',woman:'F',o:'O',other:'O','non-binary':'O',nonbinary:'O'};if(!g[v])throw Error('Use M, F or O for gender.');return g[v];}
function flag(s:string){if(!s)return undefined;if(/^(y|yes|true|1)$/i.test(s))return true;if(/^(n|no|false|0)$/i.test(s))return false;throw Error('Use Y for yes, N for no, or leave blank.');}
export function prepare(rows:Row[],mapping:Record<string,string>,kind:Kind){
 const seen=new Map<string,number>();return rows.map((r,i)=>{const get=(f:string)=>r[mapping[f]??(f==='team_name'?mapping.reference:f==='institution_code'?mapping.institution:'')]?.trim()??'';const name=get(kind==='teams'?'team_name':'name'),institution=get('institution_code');const issues:string[]=[];const details:string[]=[];const p:Record<string,any>={institution:null};const key=nameKey(name);const duplicateOf=key?seen.get(key):undefined;if(key&&!seen.has(key))seen.set(key,i+2);
 if(!name)issues.push(kind==='teams'?'Team name is required.':'Adjudicator name is required.');
 const person=(prefix='',label='Adjudicator')=>{const o:Record<string,any>={name:get(prefix+'name'),email:get(prefix+'email'),phone:get(prefix+'phone')||'1234567890',gender:'O'};if(!o.name)issues.push(`${label}: name is required.`);if(!o.email)issues.push(`${label}: email is required.`);else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email))issues.push(`${label}: invalid email address.`);try{o.gender=gender(get(prefix+'gender'));}catch(e){issues.push(`${label}: ${(e as Error).message}`);}details.push(`${label}: phone ${o.phone} · gender ${o.gender}`);return o;};
 if(kind==='teams'){p.reference=name;p.short_reference=name;p.break_categories=[];p.institution_conflicts=[];p.speakers=[];for(let j=1;j<=3;j++){const prefix=`speaker${j}_`;if(['name','email','phone','gender'].some(f=>get(prefix+f)))p.speakers.push({...person(prefix,`Speaker ${j}`),categories:[]});}if(!p.speakers.length)issues.push('At least one speaker with a name and email is required.');}
 else{Object.assign(p,person());p.institution_conflicts=[];p.team_conflicts=[];p.adjudicator_conflicts=[];const score=get('base_score')?Number(get('base_score')):5.5;if(!Number.isFinite(score)||score<0)issues.push('Base score must be a non-negative number.');else p.base_score=score;for(const f of ['independent','adj_core'])try{const b=flag(get(f));if(b!==undefined)p[f]=b;}catch(e){issues.push(`${f}: ${(e as Error).message}`);}}
 if(duplicateOf)issues.push(`Duplicate name in sheet; first appears on row ${duplicateOf}.`);
 return {row:i+2,name,status:duplicateOf?'duplicate':issues.length?'invalid':'ready',payload:p,institution,issues,details,issue:issues.join(' ')};
 });
}
async function request(url:string,token:string,method='GET',body?:unknown){const origin=new URL(url).origin;
 let current=url;let res:Response;
 for(let hop=0;;hop++){
 res=await fetch(current,{method,headers:{Authorization:`Token ${token.replace(/^Token\s+/i,'').trim()}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,redirect:'manual',signal:AbortSignal.timeout(15000)});
 if(![301,302,303,307,308].includes(res.status))break;
 const location=res.headers.get('location');if(!location||hop>=3)throw Error('Invalid or excessive Tabbycat API redirects.');
 const next=new URL(location,current);
 if(next.origin!==origin||next.username||next.password)throw Error('Blocked API redirect to another origin. Your token was not forwarded.');
 if(method!=='GET'&&(res.status===303||next.pathname.replace(/\/$/,'')!==new URL(current).pathname.replace(/\/$/,'')))throw Error('Unexpected import redirect. Check Tabbycat before retrying.');
 current=next.href;
 }
 const raw=await res.text();let data:any;try{data=JSON.parse(raw);}catch{data=null;}if(!res.ok){const error:any=new Error(`Tabbycat returned HTTP ${res.status}${data?': '+JSON.stringify(data).replaceAll(token.replace(/^Token\s+/i,'').trim(),'[redacted]').slice(0,800):'. Check the URL, token and Enable API setting.'}`);error.httpStatus=res.status;throw error;}if(data===null)throw Error('Tabbycat returned a non-JSON response. Check your URL and API settings.');return data;}
async function list(url:string,token:string){const origin=new URL(url).origin;let next:string|null=url;const all:any[]=[];for(let i=0;next&&i<100;i++){if(new URL(next).origin!==origin)throw Error('Blocked cross-origin API pagination.');const d=await request(next,token);if(Array.isArray(d)){all.push(...d);next=null;}else{if(!Array.isArray(d.results))throw Error('Unexpected Tabbycat list response.');all.push(...d.results);next=d.next?new URL(d.next,next).href:null;}}if(next)throw Error('Too many API pages to safely check duplicates.');return all;}
export async function execute(action:string,args:any){
 if(action==='read_sheet'){const u=new URL(args.sheet_url);if(u.hostname!=='docs.google.com')throw Error('Use a docs.google.com spreadsheet link.');const id=u.pathname.match(/\/spreadsheets\/d\/([\w-]+)/)?.[1];if(!id)throw Error('Invalid Google Sheet link.');const gid=args.gid??u.searchParams.get('gid')??new URLSearchParams(u.hash.slice(1)).get('gid')??'0';if(!/^\d+$/.test(String(gid)))throw Error('Invalid sheet tab ID.');const res=await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`,{signal:AbortSignal.timeout(20000)});if(!res.ok)throw Error('Cannot read this sheet. Enable Anyone with the link can view, or upload a CSV export.');const text=await res.text();if(/<!doctype|<html/i.test(text))throw Error('This sheet requires sign-in. Share it for link viewing or upload CSV.');const d=csv(text);return {...d,mapping:autoMap(d.headers,args.kind==='adjudicators'?'adjudicators':'teams')};}
 if(action==='preview_rows'){if(!Array.isArray(args.rows)||args.rows.length>2000)throw Error('Provide up to 2,000 rows.');return {rows:prepare(args.rows,args.mapping,args.kind)};}
 const t=target(args.site_url);if(!args.api_token?.trim())throw Error('An API token is required.');const kind:Kind=args.kind==='adjudicators'?'adjudicators':'teams';
 if(action==='check_connection'){const existing=await list(t.base+kind,args.api_token);return {...t,kind,existing_count:existing.length};}
 if(action!=='import_batch'&&action!=='preflight')throw Error('Unknown action.');
 if(!Array.isArray(args.rows)||!args.rows.length||args.rows.length>2000)throw Error('Provide between 1 and 2,000 rows.');
 if(action==='import_batch'&&(args.confirm!==true||args.rows.length>20))throw Error('Approve the import and provide at most 20 rows per batch.');
 const [existing,institutions]=await Promise.all([list(t.base+kind,args.api_token),list(t.origin+'/api/v1/institutions',args.api_token)]);
 const names=new Set(existing.map(x=>nameKey(String(kind==='teams'?x.reference:x.name))));
 const prepared=prepare(args.rows,args.mapping,kind);const missing=new Map<string,{code:string,rows:number[],reason:string}>();
 for(const r of prepared){
 if(r.institution){const matches=institutions.filter(x=>x.code&&nameKey(String(x.code))===nameKey(r.institution));let reason='';let link='';
 if(matches.length!==1)reason=matches.length?'Institution code is ambiguous.':'Institution code is not in Tabbycat.';
 else{try{const u=new URL(matches[0].url,t.origin);if(!matches[0].url||u.origin!==t.origin)throw Error();link=u.href;}catch{reason='Institution has no valid API resource link.';}}
 if(reason){const key=nameKey(r.institution);const item=missing.get(key)??{code:r.institution,rows:[],reason};item.rows.push(r.row);missing.set(key,item);r.issues.push(reason);if(r.status==='ready')r.status='invalid';}else r.payload.institution=link;
 }
 if(r.status!=='duplicate'&&names.has(nameKey(r.name))){r.status='skipped';r.issues.push('Name already exists in this tournament.');}r.issue=r.issues.join(' ');
 }
 const audit={tournament:t.slug,kind,rows:prepared,missing_institutions:[...missing.values()],existing_count:existing.length,institution_count:institutions.length,ready_count:prepared.filter(r=>r.status==='ready').length};
 if(action==='preflight')return audit;
 if(missing.size)return {...audit,results:prepared.map(r=>({row:r.row,name:r.name,status:'not_attempted',issue:'Import blocked: resolve missing institution codes and check the full sheet again.'})),stopped:true};
 const results:any[]=[];let stopped=false;
 for(const r of prepared){if(stopped){results.push({row:r.row,name:r.name,status:'not_attempted',issue:'Import stopped before this row.'});continue;}if(r.status!=='ready'){results.push({row:r.row,name:r.name,status:r.status,issue:r.issue});continue;}
 try{await request(t.base+kind,args.api_token,'POST',r.payload);names.add(nameKey(r.name));results.push({row:r.row,name:r.name,status:'imported',issue:''});}catch(e){const err=e as any;const ambiguous=!err.httpStatus||err.httpStatus>=500;results.push({row:r.row,name:r.name,status:ambiguous?'uncertain':'failed',issue:ambiguous?'Response was lost or server failed. Check Tabbycat before retrying.':err.message});if(ambiguous||[401,403,429].includes(err.httpStatus))stopped=true;}
 }
 return {tournament:t.slug,kind,results,stopped};
}
