 'use strict';
// El navegador solo muestra la partida. MongoDB y el servidor validan y guardan cada acción.
const $ = id => document.getElementById(id);
let CONFIG = {semilla:10,recompensa:15,duracion:60,agua:20,fertilizante:3,avance:15};
let estado = null, base = null, recibido = 0, revision = 0, seleccion = 0;
let ocupado = false, conectado = false, registro = false, token = '';
const imagenes = {vacia:'maceta-vacia.png',brote:'girasol-brote.png',planta:'girasol-planta.png',flor:'girasol-flor.png'};
const completa = p => p && p.crecimiento >= CONFIG.duracion;
const API = String(window.JARDIN_API || '').trim();
// Solo se recuerda la sesión aquí; la partida permanece en MongoDB.
try { token = localStorage.getItem('jardin-sesion') || ''; } catch {}
if (!token) {
  try { token = sessionStorage.getItem('jardin-sesion') || ''; } catch {}
}
function guardarToken(nuevo) {
  token = nuevo;
  try { if (nuevo) localStorage.setItem('jardin-sesion', nuevo); else localStorage.removeItem('jardin-sesion'); } catch {}
  try { if (nuevo) sessionStorage.setItem('jardin-sesion', nuevo); else sessionStorage.removeItem('jardin-sesion'); } catch {}
}
if (token) guardarToken(token);
function mensaje(texto) { $('mensaje').textContent = texto; }
function recibir(datos) {
  base = datos.partida;
  revision = datos.revision;
  CONFIG = datos.reglas;
  recibido = performance.now();
  conectado = true;
  $('cuenta-form').hidden = true;
  $('zona-juego').hidden = false;
  $('sesion-activa').hidden = false;
  $('nombre-usuario').textContent = `Jardín de ${datos.usuario}`;
  $('guardado').textContent = 'Tus flores y tus avances están guardados.';
  actualizarVista();
}
function actualizarVista() {
  if (!base) return;
  estado = structuredClone(base);
  const segundos = Math.max(0, (performance.now() - recibido) / 1000);
  estado.macetas.forEach(p => {
    if (!p) return;
    const avance = Math.min(segundos,p.agua,CONFIG.duracion-p.crecimiento);
    p.crecimiento += avance; p.agua -= avance;
  });
  mostrar();
}
function cerrarLocal(texto = '') {
  guardarToken(''); base = null; estado = null; conectado = false;
  $('zona-juego').hidden = true; $('sesion-activa').hidden = true; $('cuenta-form').hidden = false;
  $('cuenta-error').textContent = texto; $('guardado').textContent = 'Tus flores te esperan por aquí.';
  $('monedas').textContent = '—';
}
async function peticion(datos) {
  if (!API) throw Error('El guardado en línea todavía no está configurado.');
  const control = new AbortController();
  const timeout = setTimeout(() => control.abort(), 15000);
  try {
    const respuesta = await fetch(API, {method:'POST',headers:{'Content-Type':'application/json',...(token ? {Authorization:`Bearer ${token}`} : {})},body:JSON.stringify(datos),signal:control.signal,cache:'no-store'});
    const cuerpo = await respuesta.json();
    if (!respuesta.ok) {
      const error = Error(cuerpo.error || 'No pudimos completar la solicitud.');
      error.status = respuesta.status; error.datos = cuerpo; throw error;
    }
    return cuerpo;
  } catch(error) {
    if (error.name === 'AbortError' || error instanceof TypeError || error instanceof SyntaxError) throw Error('No pudimos conectar. Revisa tu conexión e inténtalo nuevamente.');
    throw error;
  } finally { clearTimeout(timeout); }
}
async function sincronizar() {
  if (!token || ocupado || document.hidden) return;
  ocupado = true; actualizarVista();
  try { recibir(await peticion({tipo:'estado'})); }
  catch(error) {
    if(error.status === 401) cerrarLocal(error.message);
    else { conectado = false; $('guardado').textContent = 'Sin conexión · Esperando para actualizar tu jardín'; }
  } finally { ocupado = false; actualizarVista(); }
}
async function accion(tipo) {
  if (!token || ocupado || !conectado) return;
  ocupado = true; actualizarVista();
  $('guardado').textContent = 'Guardando…';
  try {
    const datos = await peticion({tipo:'accion',accion:tipo,indice:seleccion,revision,id:crypto.randomUUID()});
    recibir(datos); mensaje(datos.mensaje);
  } catch(error) {
    if(error.datos?.partida) recibir(error.datos);
    else if(error.status === 401) cerrarLocal(error.message);
    else {
      conectado = false;
      $('guardado').textContent = 'No se confirmó el guardado · Reconectando';
    }
    mensaje(error.message + (!error.status ? ' Al reconectar revisaremos si la acción alcanzó a guardarse.' : ''));
  } finally { ocupado = false; actualizarVista(); }
}
function etapa(p) { return !p ? 'vacia' : completa(p) ? 'flor' : p.crecimiento >= CONFIG.duracion / 2 ? 'planta' : 'brote'; }
function cambiarImagen(img, tipo, alt) {
  const ruta = `assets/${imagenes[tipo]}`;
  if (img.getAttribute('src') !== ruta) img.setAttribute('src', ruta);
  img.alt = alt;
}
const tarjetas = [];
for (let i = 0; i < 6; i++) {
  const boton = document.createElement('button');
  boton.className = 'pot';
  boton.innerHTML = `<span class="pot-number">0${i + 1}</span><img src="assets/maceta-vacia.png" alt=""><span class="pot-name"></span><span class="pot-status"></span>`;
  boton.addEventListener('click', () => { seleccion = i; actualizarVista(); });
  $('macetas').append(boton);
  tarjetas.push(boton);
}
function mostrar() {
  if (!estado) return;
  $('monedas').textContent = estado.monedas;
  $('cantidad').textContent = estado.cantidad;
  $('total-tab').textContent = estado.cantidad;
  $('ocupadas').textContent = `${estado.macetas.filter(Boolean).length} / 6 plantadas`;
  $('descubierto').textContent = estado.cantidad ? 'DESCUBIERTO · 001' : 'POR DESCUBRIR · 001';
  $('flor-album').classList.toggle('undiscovered', estado.cantidad === 0);
  estado.macetas.forEach((p, i) => {
    const boton = tarjetas[i];
    const lista = completa(p);
    const nombre = !p ? 'Maceta libre' : lista ? '¡Floreció!' : 'Girasol';
    const detalle = !p ? 'Planta aquí' : lista ? 'Para coleccionar' : p.agua <= 0 ? 'Necesita agua' : `${Math.floor(p.crecimiento / CONFIG.duracion * 100)} % · Creciendo`;
    boton.classList.toggle('selected', seleccion === i);
    boton.classList.toggle('ready', Boolean(lista));
    boton.setAttribute('aria-pressed', String(seleccion === i));
    boton.setAttribute('aria-label', `Maceta ${i + 1}: ${nombre}. ${detalle}`);
    cambiarImagen(boton.querySelector('img'), etapa(p), '');
    boton.querySelector('.pot-name').textContent = nombre;
    boton.querySelector('.pot-status').textContent = detalle;
  });
  const p = estado.macetas[seleccion];
  const lista = completa(p);
  $('seleccionada').textContent = `MACETA 0${seleccion + 1}`;
  $('estado').textContent = !p ? 'Nueva semilla' : lista ? 'Un poquito de sol' : p.agua <= 0 ? 'Un sorbito de agua' : 'Está creciendo';
  $('descripcion').textContent = !p ? 'Planta un girasol y dale su primer riego.' : lista ? 'Tu girasol está listo para entrar a la colección.' : '';
  $('descripcion').hidden = ! $('descripcion').textContent;
  cambiarImagen($('imagen'), etapa(p), !p ? 'Maceta vacía' : lista ? 'Girasol florecido' : 'Girasol en crecimiento');
  const porcentaje = p ? Math.floor(p.crecimiento / CONFIG.duracion * 100) : 0;
  $('progreso').value = porcentaje;
  $('porcentaje').textContent = `${porcentaje} %`;
  $('agua').textContent = !p ? 'Tiempo de crecimiento: 1 minuto' : lista ? '¡Listo! Colecciona y recibe 15 monedas.' : p.agua <= 0 ? 'Sin agua · Crecimiento pausado' : `Agua: ${Math.ceil(p.agua)} s · Faltan ${Math.ceil(CONFIG.duracion - p.crecimiento)} s de crecimiento`;
  $('plantar').hidden = Boolean(p);
  $('plantar').disabled = estado.monedas < CONFIG.semilla;
  $('regar').hidden = !p || lista;
  $('fertilizar').hidden = !p || lista;
  $('fertilizar').disabled = estado.monedas < CONFIG.fertilizante;
  $('coleccionar').hidden = !lista;
  $('rescatar').hidden = !(estado.monedas < CONFIG.semilla && estado.macetas.every(x => x === null));
  $('regar-todas').disabled = !estado.macetas.some(x => x && !completa(x));
  for (const id of ['plantar','regar','fertilizar','coleccionar','rescatar','regar-todas']) {
    if (ocupado || !conectado) $(id).disabled = true;
    else if (['regar','coleccionar','rescatar'].includes(id)) $(id).disabled = false;
  }
  $('nota').textContent = !p ? 'Cada girasol completado te entrega 15 monedas.' : lista ? 'Tu flor se conserva para siempre en el álbum.' : 'Fertilizante opcional: avanza 15 segundos. Regar repone el agua, no la acumula.';
}

for (const tipo of ['plantar','regar','fertilizar','coleccionar','rescatar','regar-todas']) $(tipo).addEventListener('click', () => accion(tipo));
document.querySelectorAll('[data-tab]').forEach(boton => boton.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(panel => { panel.hidden = panel.id !== boton.dataset.tab; });
  document.querySelectorAll('[data-tab]').forEach(b => { b.classList.toggle('active',b === boton); b.setAttribute('aria-pressed',String(b === boton)); });
}));
$('modo-cuenta').addEventListener('click', () => {
  registro = !registro;
  $('cuenta-titulo').textContent = registro ? 'Necesito que te crees un usuario una única vez, perdón jajsjjs' : 'Qué bueno verte por aquí';
  $('cuenta-bienvenida').textContent = registro ? 'Crea tu cuenta para empezar a cuidar tus flores c:' : 'Aquí te esperan tus flores. Si usas el mismo navegador no tendrás que iniciar sesión ;)';
  $('entrar').textContent = registro ? 'Crear cuenta' : 'Entrar';
  $('modo-cuenta').textContent = registro ? 'Ya tengo cuenta' : 'Crear una cuenta';
  $('password').autocomplete = registro ? 'new-password' : 'current-password';
  $('cuenta-nota').textContent = registro ? 'Elige un usuario de 3–24 letras, números o _. Guarda tu contraseña de al menos 10 caracteres: todavía no puedo ayudarte a recuperarla. Si pierdes la contraseña, contacta con el administrador (yo)' : 'Puedes volver desde el celular o el computador con tu misma cuenta.';
  $('cuenta-error').textContent = '';
});
$('cuenta-form').addEventListener('submit', async evento => {
  evento.preventDefault(); if (ocupado) return;
  ocupado = true; $('entrar').disabled = true; $('modo-cuenta').disabled = true;
  $('cuenta-error').textContent = registro ? 'Creando tu jardín…' : 'Abriendo tu jardín…';
  try {
    const datos = await peticion({tipo:registro ? 'registro' : 'login',usuario:$('usuario').value,password:$('password').value});
    guardarToken(datos.token); recibir(datos); $('password').value = ''; $('cuenta-error').textContent = '';
    mensaje('Elige una maceta para empezar.');
  } catch(error) { $('cuenta-error').textContent = error.message; }
  finally { ocupado = false; $('entrar').disabled = false; $('modo-cuenta').disabled = false; actualizarVista(); }
});
$('salir').addEventListener('click', async () => {
  if(ocupado)return;
  ocupado=true; $('salir').disabled=true;
  try { await peticion({tipo:'logout'}); cerrarLocal(); }
  catch(error) { mensaje('No pudimos cerrar la sesión en el servidor. Revisa la conexión e inténtalo de nuevo.'); }
  finally {ocupado=false;$('salir').disabled=false;actualizarVista();}
});
document.addEventListener('visibilitychange', () => { if(!document.hidden)sincronizar(); });
window.addEventListener('online', sincronizar);
setInterval(actualizarVista, 1000);
setInterval(sincronizar, 10000);
$('monedas').textContent = '—';
if (!API) {
  $('cuenta-error').textContent = 'El jardín está en preparación. Falta conectar el guardado en línea.';
  $('entrar').disabled = true;
  $('guardado').textContent = 'Guardado en línea pendiente de configuración';
} else if (token) sincronizar();
