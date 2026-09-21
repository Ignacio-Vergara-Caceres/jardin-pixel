import {randomBytes,scrypt as scryptCallback,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback);
export const hash=texto=>createHash('sha256').update(texto).digest('hex');
export async function clave(password,sal=randomBytes(16).toString('hex')){
  const resultado=await scrypt(password,sal,64,{N:16384,r:8,p:1});
  return {sal,hash:resultado.toString('hex')};
}
export async function verificar(password,guardada){
  const actual=await clave(password,guardada.sal);
  const a=Buffer.from(actual.hash,'hex'),b=Buffer.from(guardada.hash,'hex');
  return a.length===b.length&&timingSafeEqual(a,b);
}
export async function nuevaSesion(base,id){
  const token=randomBytes(32).toString('hex');
  await base.collection('sesiones').insertOne({_id:hash(token),usuarioId:id,expira:new Date(Date.now()+30*86400000)});
  return token;
}
export async function limite(base,identidad,maximo){
  const ventana=Math.floor(Date.now()/900000);
  const _id=hash(`${identidad}:${ventana}`);
  // _id único hace que el contador sea atómico también entre instancias del servidor.
  let fila;
  try{fila=await base.collection('limites').findOneAndUpdate({_id},{$inc:{cantidad:1},$setOnInsert:{expira:new Date((ventana+2)*900000)}},{upsert:true,returnDocument:'after'});}
  catch(error){if(error.code!==11000)throw error;fila=await base.collection('limites').findOneAndUpdate({_id},{$inc:{cantidad:1}},{returnDocument:'after'});}
  return fila.cantidad<=maximo;
}
