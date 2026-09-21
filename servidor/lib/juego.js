export const REGLAS = Object.freeze({semilla:10,recompensa:15,duracion:60,agua:20,fertilizante:3,avance:15});
export function inicial(ahora=Date.now()) {
  return {monedas:50,cantidad:0,macetas:Array(6).fill(null),ultimoTiempo:ahora};
}
export function avanzar(partida,ahora=Date.now()) {
  const p=structuredClone(partida);
  const segundos=Math.max(0,(ahora-p.ultimoTiempo)/1000);
  for(const planta of p.macetas) {
    if(!planta) continue;
    const avance=Math.min(segundos,planta.agua,REGLAS.duracion-planta.crecimiento);
    planta.crecimiento=Math.min(REGLAS.duracion,planta.crecimiento+avance);
    planta.agua=Math.max(0,planta.agua-avance);
  }
  p.ultimoTiempo=ahora;
  return p;
}
export function aplicar(partida,tipo,indice,ahora=Date.now()) {
  if(!Number.isInteger(indice)||indice<0||indice>5) throw Error('Elige una maceta válida.');
  const p=avanzar(partida,ahora),flor=p.macetas[indice];
  const madura=flor&&flor.crecimiento>=REGLAS.duracion;
  let mensaje;
  switch(tipo){
    case 'plantar':
      if(flor||p.monedas<REGLAS.semilla) throw Error('No puedes plantar en esta maceta.');
      p.monedas-=REGLAS.semilla;p.macetas[indice]={crecimiento:0,agua:0};mensaje='Semilla plantada. ¡Dale su primer riego!';break;
    case 'regar':
      if(!flor||madura) throw Error('Esta maceta no necesita agua.');
      flor.agua=REGLAS.agua;mensaje='Agua fresca para tu girasol.';break;
    case 'regar-todas':
      p.macetas.forEach(x=>{if(x&&x.crecimiento<REGLAS.duracion)x.agua=REGLAS.agua});mensaje='Tus girasoles tienen agua fresca.';break;
    case 'fertilizar':
      if(!flor||madura||p.monedas<REGLAS.fertilizante) throw Error('No puedes aplicar fertilizante ahora.');
      p.monedas-=REGLAS.fertilizante;flor.crecimiento=Math.min(REGLAS.duracion,flor.crecimiento+REGLAS.avance);mensaje='Fertilizante aplicado.';break;
    case 'coleccionar':
      if(!madura) throw Error('Este girasol aún no está listo.');
      p.cantidad++;p.monedas+=REGLAS.recompensa;p.macetas[indice]=null;mensaje='Un girasol más para tu colección. ¡Ganaste 15 monedas!';break;
    case 'rescatar':
      if(p.monedas>=REGLAS.semilla||p.macetas.some(Boolean)) throw Error('Todavía puedes continuar con tu jardín.');
      p.macetas[indice]={crecimiento:0,agua:0};mensaje='Una semilla de rescate para volver a empezar. Riégala gratis.';break;
    default: throw Error('Acción desconocida.');
  }
  return {partida:p,mensaje};
}
