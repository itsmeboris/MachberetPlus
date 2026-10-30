import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
export type Actor = {id:string; role:'teacher'|'student'; name:string; teacher_id:string|null; preferences:string};
export type Env = {Bindings:{DB:D1Database;ASSETS?:Fetcher}; Variables:{actor:Actor}};
export type Ctx = Context<Env>;
export function fail(status:400|401|403|404|409|413|429,message:string):never {throw new HTTPException(status,{message});}
export async function input<T extends z.ZodType>(c:Ctx,schema:T):Promise<z.infer<T>> {
  let raw:unknown; try { raw=await c.req.json(); } catch {fail(400,'נתונים לא תקינים');}
  const result=schema.safeParse(raw); if(!result.success) fail(400,'יש לבדוק את השדות שהוזנו');
  return result.data;
}
export function teacher(c:Ctx) {const a=c.get('actor');if(a.role!=='teacher')fail(403,'פעולה למורה בלבד');return a;}
export interface AssignmentRow {id:string;teacher_id:string;student_id:string;title:string;status:string;exercises:string;confirmed:number;answers:string;revision:number;feedback:string;source_id:string|null;instructions_id:string|null;created_at:number;updated_at:number;acknowledged_at:number|null}
export async function assignment(c:Ctx,id:string):Promise<AssignmentRow> {
  const a=c.get('actor');
  const row=await c.env.DB.prepare('SELECT * FROM assignments WHERE id=? AND (teacher_id=? OR (student_id=? AND status != ?))').bind(id,a.id,a.id,'draft').first<AssignmentRow>();
  if(!row)fail(404,'המשימה לא נמצאה');return row;
}
export function present(a:AssignmentRow) {return {id:a.id,studentId:a.student_id,title:a.title,status:a.status,exercises:JSON.parse(a.exercises),confirmed:!!a.confirmed,answers:JSON.parse(a.answers),revision:a.revision,feedback:JSON.parse(a.feedback),sourceId:a.source_id,instructionsId:a.instructions_id,createdAt:a.created_at,updatedAt:a.updated_at,acknowledgedAt:a.acknowledged_at};}
export function event(db:D1Database,id:string,kind:string) {return db.prepare('INSERT INTO events (id,assignment_id,kind,at) VALUES (?,?,?,?)').bind(crypto.randomUUID(),id,kind,Date.now());}
