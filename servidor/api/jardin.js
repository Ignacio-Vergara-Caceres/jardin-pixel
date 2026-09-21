import {db} from '../lib/db.js';
import {clave,verificar,hash,nuevaSesion,limite} from '../lib/auth.js';
import {inicial,avanzar,aplicar,REGLAS} from '../lib/juego.js';
const salida=(res,status,cuerpo)=>res.status(status).json(cuerpo);
const vista=u=>({usuario:u.usuario,revision:u.revision,partida:avanzar(u.partida),reglas:REGLAS});
export function crearHandler(obtenerDb=db){
return async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  const origen=req.headers.origin;
  const permitidos=(process.env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
  if(origen&&!permitidos.includes(origen))return salida(res,403,{error:'Origen no autorizado.'});
  if(origen){res.setHeader('Access-Control-Allow-Origin',origen);res.setHeader('Vary','Origin');}
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='POST')return salida(res,405,{error:'Método no permitido.'});
  try{
    if(Number(req.headers['content-length']||0)>8192)return salida(res,413,{error:'Solicitud demasiado grande.'});
    let datos=req.body;
    if(typeof datos==='string'){try{datos=JSON.parse(datos)}catch{return salida(res,400,{error:'Solicitud inválida.'})}}
    if(!datos||typeof datos!=='object'||Array.isArray(datos))return salida(res,400,{error:'Solicitud inválida.'});
    if(JSON.stringify(datos).length>8192)return salida(res,413,{error:'Solicitud demasiado grande.'});
    const base=await obtenerDb(),usuarios=base.collection('usuarios');
    if(datos.tipo==='registro'||datos.tipo==='login'){
      const ip=String(req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for']||req.socket?.remoteAddress||'desconocida').split(',')[0].trim();
      if(!await limite(base,`auth-ip:${ip}`,60))return salida(res,429,{error:'Demasiados intentos. Espera 15 minutos.'});
      const usuario=typeof datos.usuario==='string'?datos.usuario.trim().toLowerCase():'';
      const password=datos.password;
      if(!/^[a-z0-9_]{3,24}$/.test(usuario)||typeof password!=='string'||password.length<10||password.length>128)return salida(res,400,{error:'Usuario: 3–24 letras, números o _. Contraseña: 10–128 caracteres.'});
      if(!await limite(base,`auth-user:${usuario}`,20))return salida(res,429,{error:'Demasiados intentos para esta cuenta. Espera 15 minutos.'});
      let u;
      if(datos.tipo==='registro'){
        const credencial=await clave(password);
        u={usuario,credencial,revision:0,partida:inicial(),acciones:[],creado:new Date()};
        try{const r=await usuarios.insertOne(u);u._id=r.insertedId;}catch(e){if(e.code===11000)return salida(res,409,{error:'Ese usuario ya existe. Elige otro o inicia sesión.'});throw e;}
      }else{
        u=await usuarios.findOne({usuario});
        const credencial=u?.credencial||{sal:'00000000000000000000000000000000',hash:'00'.repeat(64)};
        const correcta=await verificar(password,credencial);
        if(!u||!correcta)return salida(res,401,{error:'Usuario o contraseña incorrectos.'});
      }
      const token=await nuevaSesion(base,u._id);
      return salida(res,200,{token,...vista(u)});
    }
    const token=String(req.headers.authorization||'').replace(/^Bearer /,'');
    if(!/^[a-f0-9]{64}$/.test(token))return salida(res,401,{error:'Inicia sesión para continuar.'});
    const sesion=await base.collection('sesiones').findOne({_id:hash(token),expira:{$gt:new Date()}});
    if(!sesion)return salida(res,401,{error:'Tu sesión terminó. Vuelve a entrar.'});
    if(datos.tipo==='logout'){await base.collection('sesiones').deleteOne({_id:hash(token)});return salida(res,200,{ok:true});}
    const u=await usuarios.findOne({_id:sesion.usuarioId});
    if(!u)return salida(res,401,{error:'Cuenta no encontrada.'});
    if(datos.tipo==='estado')return salida(res,200,vista(u));
    if(datos.tipo!=='accion')return salida(res,400,{error:'Solicitud desconocida.'});
    if(!await limite(base,`acciones:${u._id}`,1800))return salida(res,429,{error:'Demasiadas acciones. Espera unos minutos.'});
    if(typeof datos.id!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(datos.id))return salida(res,400,{error:'Identificador inválido.'});
    if(u.acciones.includes(datos.id))return salida(res,200,{...vista(u),mensaje:'La acción ya estaba guardada.'});
    if(datos.revision!==u.revision)return salida(res,409,{...vista(u),error:'Tu jardín cambió en otra pestaña o dispositivo. Ya lo actualizamos; vuelve a intentar.'});
    let resultado;
    try{resultado=aplicar(u.partida,datos.accion,datos.indice);}catch(e){return salida(res,400,{...vista(u),error:e.message});}
    // Una sola escritura atómica: compras, recompensa e inventario se guardan juntos.
    const actualizado=await usuarios.findOneAndUpdate({_id:u._id,revision:u.revision},{
      $set:{partida:resultado.partida},$inc:{revision:1},$push:{acciones:{$each:[datos.id],$slice:-100}}
    },{returnDocument:'after'});
    if(!actualizado){const actual=await usuarios.findOne({_id:u._id});return salida(res,409,{...vista(actual),error:'El jardín cambió. Revisa el estado antes de repetir la acción.'});}
    return salida(res,200,{...vista(actualizado),mensaje:resultado.mensaje});
  }catch(error){
    // No registrar URI, contraseñas, tokens ni datos de la solicitud.
    console.error('Error de servidor',error.name,error.code||'');
    return salida(res,503,{error:'No pudimos conectar con tu jardín. Inténtalo de nuevo en un momento.'});
  }
}
}
export default crearHandler();
