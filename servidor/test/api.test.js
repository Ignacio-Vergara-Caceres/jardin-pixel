import test from 'node:test';
import assert from 'node:assert/strict';
import {crearHandler} from '../api/jardin.js';
// Doble en memoria: prueba los límites HTTP y escrituras condicionales, no una conexión MongoDB real.
function basePrueba(){
 const tablas=new Map();let id=0;
 const copia=x=>x?structuredClone(x):x;
 const match=(r,q)=>Object.entries(q).every(([k,v])=>v&&typeof v==='object'&&'$gt' in v?r[k]>v.$gt:r[k]===v);
 return {collection(nombre){
  if(!tablas.has(nombre))tablas.set(nombre,[]);const filas=tablas.get(nombre);
  return {
   async findOne(q){return copia(filas.find(x=>match(x,q)))},
   async insertOne(obj){if(filas.some(x=>x._id===obj._id&&obj._id||nombre==='usuarios'&&x.usuario===obj.usuario)){const e=Error();e.code=11000;throw e}obj._id??=String(++id);filas.push(copia(obj));return {insertedId:obj._id}},
   async deleteOne(q){const i=filas.findIndex(x=>match(x,q));if(i>=0)filas.splice(i,1)},
   async findOneAndUpdate(q,u,opts={}){
    let r=filas.find(x=>match(x,q));
    if(!r&&opts.upsert){r={...q,...u.$setOnInsert};filas.push(r)}
    if(!r)return null;
    Object.assign(r,copia(u.$set)||{});
    for(const [k,v]of Object.entries(u.$inc||{}))r[k]=(r[k]||0)+v;
    for(const [k,v]of Object.entries(u.$push||{}))r[k]=[...(r[k]||[]),...v.$each].slice(v.$slice);
    return copia(r);
   }
  };
 }};
}
function cliente(handler){return async(body,token='',origin='https://jardin.example')=>{
 let status=200;let output;const headers={};
 await handler({method:'POST',headers:{origin,authorization:token?'Bearer '+token:'','x-vercel-forwarded-for':'127.0.0.1'},body},{setHeader:(k,v)=>headers[k]=v,status(n){status=n;return this},json(v){output=v;return this},end(){}});
 return {status,body:output,headers};
};}
test('API: cuentas aisladas, sesiones, idempotencia, concurrencia y servidor autoritativo',async()=>{
 process.env.ALLOWED_ORIGINS='https://jardin.example';
 const base=basePrueba(),call=cliente(crearHandler(async()=>base));
 assert.equal((await call({tipo:'estado'})).status,401);
 assert.equal((await call({tipo:'estado'},'','https://otro.example')).status,403);
 const a=await call({tipo:'registro',usuario:'ana',password:'password-de-prueba'});
 assert.equal(a.status,200);assert.equal(a.body.partida.monedas,50);assert.equal(a.body.credencial,undefined);
 const token=a.body.token;
 assert.equal((await call({tipo:'login',usuario:'ana',password:'clave-incorrecta'})).status,401);
 const b=await call({tipo:'registro',usuario:'bea',password:'password-de-prueba'});
 const accion={tipo:'accion',accion:'plantar',indice:0,revision:0,id:'operacion-prueba-0001',monedas:999999};
 const primero=await call(accion,token);assert.equal(primero.body.partida.monedas,40);
 const repetido=await call(accion,token);assert.equal(repetido.body.partida.monedas,40);
 assert.equal((await call({tipo:'estado'},b.body.token)).body.partida.monedas,50);
 const simultaneas=await Promise.all([call({...accion,indice:1,revision:1,id:'operacion-prueba-0002'},token),call({...accion,indice:2,revision:1,id:'operacion-prueba-0003'},token)]);
 assert.deepEqual(simultaneas.map(r=>r.status).sort(),[200,409]);
 assert.equal((await call({tipo:'estado'},token)).body.partida.monedas,30);
 const login=await call({tipo:'login',usuario:'ana',password:'password-de-prueba'});
 assert.equal(login.body.partida.monedas,30);
 await call({tipo:'logout'},token);assert.equal((await call({tipo:'estado'},token)).status,401);
});
