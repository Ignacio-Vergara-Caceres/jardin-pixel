'use strict';
// Cambia estos valores si quieres ajustar la duración o la economía del juego.
const CONFIG = Object.freeze({semilla: 10, recompensa: 15, duracion: 60, agua: 20, fertilizante: 3, avance: 15});
const CLAVE = 'jardin-pixel-v2';
const ANTERIOR = 'jardin-pixel-v1';
const $ = id => document.getElementById(id);
let seleccion = 0;
let falloGuardado = false;
let protegerGuardado = false;
let estado = {version: 2, monedas: 50, cantidad: 0, macetas: Array(6).fill(null), ultimoTiempo: Date.now()};
const imagenes = {vacia: 'maceta-vacia.png', brote: 'girasol-brote.png', planta: 'girasol-planta.png', flor: 'girasol-flor.png'};
const completa = p => p && p.crecimiento >= CONFIG.duracion;
const numero = n => Number.isFinite(n) && n >= 0;
function validar(datos) {
  if (!datos || !numero(datos.monedas) || !Number.isSafeInteger(datos.monedas) || !numero(datos.cantidad) || !Number.isSafeInteger(datos.cantidad) || !numero(datos.ultimoTiempo)) throw Error('Partida inválida');
  let macetas;
  if (datos.version === 2) macetas = datos.macetas;
  else if (Object.hasOwn(datos, 'planta')) macetas = [datos.planta, ...Array(5).fill(null)];
  else throw Error('Formato desconocido');
  if (!Array.isArray(macetas) || macetas.length !== 6) throw Error('Macetas inválidas');
  macetas = macetas.map(p => {
    if (p === null) return null;
    if (!p || !numero(p.crecimiento) || p.crecimiento > CONFIG.duracion || !numero(p.agua) || p.agua > CONFIG.agua) throw Error('Planta inválida');
    return {crecimiento: p.crecimiento, agua: p.agua};
  });
  return {version: 2, monedas: datos.monedas, cantidad: datos.cantidad, macetas, ultimoTiempo: Math.min(Date.now(), datos.ultimoTiempo)};
}
function mensaje(texto) { $('mensaje').textContent = texto; }
function cargar() {
  try {
    const texto = localStorage.getItem(CLAVE) || localStorage.getItem(ANTERIOR);
    if (texto) estado = validar(JSON.parse(texto));
  } catch {
    protegerGuardado = true;
    mensaje('No se pudo leer la partida. El guardado anterior se conserva; puedes importar una copia desde Cómo jugar.');
  }
}
function guardar() {
  if (protegerGuardado) { $('guardado').textContent = 'Guardado protegido: importa una copia válida'; return; }
  try {
    localStorage.setItem(CLAVE, JSON.stringify(estado));
    $('guardado').textContent = 'Guardado en este navegador';
    falloGuardado = false;
  } catch {
    $('guardado').textContent = 'Sin guardado: descarga tu partida en Cómo jugar';
    if (!falloGuardado) mensaje('El navegador no permite guardar. Descarga tu partida desde Cómo jugar antes de cerrar.');
    falloGuardado = true;
  }
}
function avanzar(ahora = Date.now()) {
  const segundos = Math.max(0, (ahora - estado.ultimoTiempo) / 1000);
  estado.ultimoTiempo = ahora;
  for (const p of estado.macetas) {
    if (!p) continue;
    const avance = Math.min(segundos, p.agua, CONFIG.duracion - p.crecimiento);
    p.crecimiento = Math.min(CONFIG.duracion, p.crecimiento + avance);
    p.agua = Math.max(0, p.agua - avance);
  }
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
  boton.addEventListener('click', () => { seleccion = i; avanzar(); mostrar(); guardar(); });
  $('macetas').append(boton);
  tarjetas.push(boton);
}
function mostrar() {
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
  $('estado').textContent = !p ? 'Un nuevo comienzo' : lista ? 'Un poquito de sol' : p.agua <= 0 ? 'Un sorbito de agua' : 'Está creciendo';
  $('descripcion').textContent = !p ? 'Planta un girasol y dale su primer riego.' : lista ? 'Tu girasol está listo para entrar a la colección.' : 'Cada pequeño cuidado lo acerca a florecer.';
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
  $('nota').textContent = !p ? 'Cada girasol completado te entrega 15 monedas.' : lista ? 'Tu flor se conserva para siempre en el álbum.' : 'Fertilizante opcional: avanza 15 segundos. Regar repone el agua, no la acumula.';
}
function accion(tipo) {
  avanzar();
  const p = estado.macetas[seleccion];
  if (tipo === 'plantar' && !p && estado.monedas >= CONFIG.semilla) {
    estado.monedas -= CONFIG.semilla;
    estado.macetas[seleccion] = {crecimiento: 0, agua: 0};
    mensaje('Semilla plantada. ¡Dale su primer riego!');
  } else if (tipo === 'regar' && p && !completa(p)) {
    p.agua = CONFIG.agua;
    mensaje('Agua fresca para tu girasol.');
  } else if (tipo === 'fertilizar' && p && !completa(p) && estado.monedas >= CONFIG.fertilizante) {
    const avance = Math.min(CONFIG.avance, CONFIG.duracion - p.crecimiento);
    estado.monedas -= CONFIG.fertilizante;
    p.crecimiento += avance;
    mensaje(`Fertilizante aplicado: ${avance.toFixed(1)} segundos de progreso.`);
  } else if (tipo === 'coleccionar' && completa(p)) {
    estado.cantidad++;
    estado.monedas += CONFIG.recompensa;
    estado.macetas[seleccion] = null;
    mensaje('Un girasol más para tu colección. ¡Ganaste 15 monedas!');
  } else if (tipo === 'rescatar' && !p && estado.monedas < CONFIG.semilla && estado.macetas.every(x => x === null)) {
    estado.macetas[seleccion] = {crecimiento: 0, agua: 0};
    mensaje('Una semilla de rescate para volver a empezar. Riégala gratis.');
  }
  mostrar(); guardar();
}
for (const tipo of ['plantar', 'regar', 'fertilizar', 'coleccionar', 'rescatar']) $(tipo).addEventListener('click', () => accion(tipo));
$('regar-todas').addEventListener('click', () => {
  avanzar();
  let numero = 0;
  estado.macetas.forEach(p => { if (p && !completa(p)) { p.agua = CONFIG.agua; numero++; } });
  mensaje(numero ? `Regaste ${numero} ${numero === 1 ? 'girasol' : 'girasoles'}. Todo listo para crecer.` : 'No hay plantas que necesiten riego.');
  mostrar(); guardar();
});
document.querySelectorAll('[data-tab]').forEach(boton => boton.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(panel => { panel.hidden = panel.id !== boton.dataset.tab; });
  document.querySelectorAll('[data-tab]').forEach(b => {
    b.classList.toggle('active', b === boton);
    b.setAttribute('aria-pressed', String(b === boton));
  });
}));
$('exportar').addEventListener('click', () => {
  avanzar(); guardar(); mostrar();
  const url = URL.createObjectURL(new Blob([JSON.stringify(estado, null, 2)], {type: 'application/json'}));
  const enlace = document.createElement('a');
  enlace.href = url; enlace.download = 'mi-jardin-partida.json'; enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  mensaje('Partida descargada. Consérvala para continuar en otro navegador.');
});
$('importar').addEventListener('click', () => $('archivo').click());
$('archivo').addEventListener('change', async evento => {
  const archivo = evento.target.files[0];
  if (!archivo) return;
  try {
    if (archivo.size > 100000) throw Error('Archivo demasiado grande');
    const nueva = validar(JSON.parse(await archivo.text()));
    if (!confirm('¿Reemplazar la partida actual por esta copia? Descarga primero tu partida actual si quieres conservarla.')) return;
    estado = nueva; protegerGuardado = false; seleccion = 0;
    avanzar(); mostrar(); guardar();
    mensaje('Partida importada. Bienvenido de vuelta a tu jardín.');
  } catch { mensaje('No se pudo importar: elige una partida JSON válida de este juego. Tu partida actual no cambió.'); }
  finally { evento.target.value = ''; }
});
window.addEventListener('storage', evento => {
  if (evento.key !== CLAVE || !evento.newValue) return;
  try { estado = validar(JSON.parse(evento.newValue)); avanzar(); mostrar(); } catch { /* Ignora cambios inválidos de otra pestaña. */ }
});
document.addEventListener('visibilitychange', () => { avanzar(); mostrar(); guardar(); });
window.addEventListener('pagehide', () => { avanzar(); guardar(); });
cargar(); avanzar(); mostrar(); guardar();
setInterval(() => { if (!document.hidden) { avanzar(); mostrar(); guardar(); } }, 1000);
