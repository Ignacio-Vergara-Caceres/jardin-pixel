import {MongoClient} from 'mongodb';
let conexion;
export async function db(){
  if(!process.env.MONGODB_URI) throw Error('MONGODB_URI no configurada');
  if(!conexion) conexion=(async()=>{
    const cliente=new MongoClient(process.env.MONGODB_URI,{maxPoolSize:5,serverSelectionTimeoutMS:8000});
    try{
      await cliente.connect();
      const base=cliente.db(process.env.MONGODB_DB||'flores_amarillas');
      await Promise.all([
        base.collection('usuarios').createIndex({usuario:1},{unique:true}),
        base.collection('sesiones').createIndex({expira:1},{expireAfterSeconds:0}),
        base.collection('limites').createIndex({expira:1},{expireAfterSeconds:0})
      ]);
      return base;
    }catch(error){await cliente.close();throw error;}
  })().catch(error=>{conexion=null;throw error});
  return conexion;
}
