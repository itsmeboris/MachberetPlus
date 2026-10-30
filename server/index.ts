import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { bodyLimit } from 'hono/body-limit';
import { auth,loadActor } from './auth';
import { assignments,parent } from './assignments';
import { students,preferences } from './students';
import {type Env,input,teacher} from './database';
import {media,parentMedia} from './media';
const app = new Hono<Env>();
app.use('/api/*',async(c,next)=>{
  c.header('Cache-Control','no-store');c.header('Referrer-Policy','no-referrer');c.header('X-Content-Type-Options','nosniff');
  if(!['GET','HEAD','OPTIONS'].includes(c.req.method)){
    const origin=c.req.header('Origin');
    if(!origin||origin!==new URL(c.req.url).origin)return c.json({error:'בקשה ממקור לא מורשה'},403);
  }
  await next();
});
app.use('/api/*',bodyLimit({maxSize:1024*1024,onError:c=>c.json({error:'הבקשה גדולה מדי'},413)}));
app.route('/api/auth',auth);
app.route('/api/parent',parent);
app.route('/api/parent',parentMedia);
app.use('/api/*',async(c,next)=>{await loadActor(c);await next();});
app.route('/api/students',students);
app.route('/api/assignments',assignments);
app.route('/api/media',media);
app.delete('/api/account',async c=>{const a=teacher(c);await c.env.DB.prepare('DELETE FROM users WHERE id=?').bind(a.id).run();return c.json({ok:true});});
app.get('/api/preferences',c=>c.json(preferences.parse(JSON.parse(c.get('actor').preferences))));
app.put('/api/preferences',async c=>{const p=await input(c,preferences);await c.env.DB.prepare('UPDATE users SET preferences=? WHERE id=?').bind(JSON.stringify(p),c.get('actor').id).run();return c.json(p);});
app.onError((error,c)=>{if(error instanceof HTTPException)return c.json({error:error.message},error.status);console.error('API failure',error instanceof Error?error.name:'unknown');return c.json({error:'אירעה שגיאה בשמירה. העבודה הקיימת לא נמחקה. נסו שוב.'},500);});
app.notFound(c=>c.json({error:'לא נמצא'},404));
export default app;
