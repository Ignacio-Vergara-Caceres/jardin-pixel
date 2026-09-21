import test from 'node:test';
import assert from 'node:assert/strict';
import {inicial,avanzar,aplicar} from '../lib/juego.js';
import {clave,verificar} from '../lib/auth.js';
test('riego gratuito, crecimiento offline limitado por agua y recompensa única',()=>{
 let p=aplicar(inicial(1000),'plantar',0,1000).partida;
 assert.equal(p.monedas,40);
 p=aplicar(p,'regar',0,1000).partida;
 p=avanzar(p,100000);assert.equal(p.macetas[0].crecimiento,20);assert.equal(p.macetas[0].agua,0);
 for(let i=0;i<3;i++)p=aplicar(p,'fertilizar',0,100000).partida;
 assert.equal(p.macetas[0].crecimiento,60);assert.equal(p.monedas,31);
 p=aplicar(p,'coleccionar',0,100000).partida;
 assert.equal(p.monedas,46);assert.equal(p.cantidad,1);
 assert.throws(()=>aplicar(p,'coleccionar',0,100000));
});
test('no saldo negativo, no macetas fuera de rango ni acciones inventadas',()=>{
 const p=inicial(1000);p.monedas=0;
 assert.throws(()=>aplicar(p,'plantar',0,1000));
 assert.throws(()=>aplicar(p,'regar',-1,1000));
 assert.throws(()=>aplicar(p,'monedas-gratis',0,1000));
 const r=aplicar(p,'rescatar',0,1000).partida;
 assert.equal(r.monedas,0);assert.throws(()=>aplicar(r,'rescatar',1,1000));
});
test('tiempo y seis macetas independientes',()=>{
 let p=inicial(1000);p.monedas=60;
 for(let i=0;i<6;i++)p=aplicar(p,'plantar',i,1000).partida;
 p=aplicar(p,'regar-todas',0,1000).partida;
 p=avanzar(p,11000);assert.ok(p.macetas.every(x=>x.crecimiento===10&&x.agua===10));
 const anterior=structuredClone(p);const despues=avanzar(p,1000);
 assert.equal(despues.macetas[0].crecimiento,10);assert.deepEqual(p,anterior);
});
test('contraseñas con sal y verificación',async()=>{
 const a=await clave('girasol-amarillo-123');const b=await clave('girasol-amarillo-123');
 assert.notEqual(a.hash,b.hash);assert.equal(await verificar('girasol-amarillo-123',a),true);assert.equal(await verificar('otra-clave-456',a),false);
});
