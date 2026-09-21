#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.join(__dirname, '..');
const storeMap = new Map();
const listeners = {};
const nodes = new Map();

function makeNode(id, extras){
  const node = {
    id,
    value: '',
    textContent: '',
    innerHTML: '',
    style: {},
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    dataset: {},
    disabled: false,
    checked: false,
    children: [],
    parentNode: null,
    focus(){},
    remove(){},
    appendChild(c){ this.children.push(c); return c; },
    setAttribute(){},
    getAttribute(){ return null; },
    addEventListener(){},
    querySelector(){ return null; },
    querySelectorAll(){ return []; },
    ...extras
  };
  if(id) nodes.set(id, node);
  return node;
}

function $(sel){
  if(!sel) return null;
  if(sel[0]==='#') return nodes.get(sel.slice(1)) || makeNode(sel.slice(1));
  return null;
}

const localStorage = {
  getItem(k){ return storeMap.has(k) ? storeMap.get(k) : null; },
  setItem(k,v){ storeMap.set(String(k), String(v)); },
  removeItem(k){ storeMap.delete(k); },
  clear(){ storeMap.clear(); },
  key(i){ return [...storeMap.keys()][i] || null; },
  get length(){ return storeMap.size; }
};

const document = {
  readyState: 'loading',
  body: makeNode(null),
  documentElement: { style: { setProperty(){} } },
  getElementById(id){ return nodes.get(id) || null; },
  querySelector: $,
  querySelectorAll(sel){
    if(sel==='[id^="p-"]') return [...nodes.values()].filter(n=>String(n.id||'').startsWith('p-'));
    return [];
  },
  createElement(tag){ return makeNode(null, {tagName:String(tag).toUpperCase()}); },
  addEventListener(type, fn){ (listeners[type]||(listeners[type]=[])).push(fn); }
};

const windowObj = {
  localStorage,
  document,
  gsap: null,
  jspdf: { jsPDF: function(){ this.text=()=>{}; this.save=()=>{}; this.output=()=>({}); } },
  MayaAuth: { authenticated: true, canWrite: ()=>true, isAdmin: ()=>true, profile: {display_name:'teste'}, roleLabel: ()=>'admin', role:'admin' },
  matchMedia: ()=>({ matches:false, addEventListener(){} }),
  addEventListener(type, fn){ (listeners[type]||(listeners[type]=[])).push(fn); },
  dispatchEvent(ev){ (listeners[ev.type]||[]).forEach(fn=>fn(ev)); return true; },
  CustomEvent: class CustomEvent { constructor(type){ this.type=type; } },
  location: { hash: '#/', href: 'https://mayagarden.pages.dev/', protocol: 'https:', host:'mayagarden.pages.dev', pathname:'/', search:'', reload(){} },
  history: { replaceState(){} },
  navigator: { userAgent: 'node', serviceWorker: undefined, share: undefined, clipboard: { writeText: async()=>{} } },
  visualViewport: null,
  innerHeight: 800,
  setTimeout,
  clearTimeout,
  structuredClone: global.structuredClone,
  Number,
  Math,
  Date,
  JSON,
  String,
  Array,
  Object,
  console,
  toast(msg){ windowObj.__toasts.push(String(msg)); },
  __toasts: []
};
windowObj.window = windowObj;
windowObj.globalThis = windowObj;

const ctx = vm.createContext(windowObj);
function load(file){
  const code = fs.readFileSync(path.join(root, file), 'utf8');
  vm.runInContext(code, ctx, { filename: file });
}

load('store.js');
load('pricing.js');

function ok(cond, msg){ assert.ok(cond, msg); }
function eq(a,b,msg){ assert.strictEqual(a,b,msg); }

// --- preço: deslocamento 0 e margem 0 ---
ctx.Store.pricing = { ...ctx.Store.pricing, marginPct: 0, horaIdeal: 50 };
const zeroDesloc = ctx.sugerirPreco({ tipo:'hora', horas:2, insumos:0, desloc:0 });
eq(zeroDesloc.min, 60, 'hora min sem desloc extra');
eq(zeroDesloc.ideal, 100, 'hora ideal = 2x50, desloc 0');
eq(zeroDesloc.margemPct, 0, 'margem zero preservada no retorno');

const withDefault = ctx.sugerirPreco({ tipo:'hora', horas:2 });
ok(withDefault.ideal > zeroDesloc.ideal, 'sem desloc informado usa o padrão da empresa');

ctx.Store.pricing = { ...ctx.Store.pricing, marginPct: 0 };
const gen = ctx.sugerirPreco({ tipo:'visita', horas:0, insumos:100, desloc:0 });
eq(gen.ideal, 100, 'visita com margem 0 e desloc 0 = só insumos');
eq(gen.margemPct, 0, 'visita reporta margem 0');

// --- teto de projeto pequeno não fica abaixo de 2000 ---
ctx.Store.pricing = { ...ctx.Store.pricing, projetoM2Min:20, projetoM2Ideal:40, projetoM2Max:60 };
const tiny = ctx.sugerirPreco({ tipo:'projeto_m2', area:10, desloc:0, insumos:0 });
ok(tiny.min >= 2000, 'piso de projeto >= 2000');
ok(tiny.ideal >= 2000, 'ideal de projeto >= 2000');
ok(tiny.max >= 2000, 'teto de projeto pequeno não fica abaixo de 2000');
ok(tiny.max >= tiny.ideal && tiny.ideal >= tiny.min, 'faixa ordenada min<=ideal<=max');

const grama = ctx.sugerirPreco({ tipo:'grama_m2', area:80, desloc:0, insumos:0, complexidade:'simples' });
eq(grama.ideal, 640, '80 m² de grama × R$ 8');
const irrig = ctx.sugerirPreco({ tipo:'irrigacao_m2', area:50, desloc:0, insumos:0, complexidade:'simples' });
eq(irrig.ideal, 1500, '50 m² de irrigação × R$ 30');
const premiumG = ctx.sugerirPreco({ tipo:'grama_m2', area:80, desloc:0, insumos:0, complexidade:'premium' });
ok(premiumG.ideal > grama.ideal, 'premium aumenta corte de grama');

const appCode = fs.readFileSync(path.join(root, 'app.js'), 'utf8') + `
window.__setDraft = function(d){ Draft = d; };
window.__getDraft = function(){ return Draft; };
toast = function(msg){ (window.__toasts = window.__toasts || []).push(String(msg)); };
`;
vm.runInContext(appCode, ctx, { filename: 'app.js' });

function field(id, value){
  const n = makeNode(id);
  n.value = value==null ? '' : String(value);
  return n;
}

['f-m2tipo','f-m2area','f-m2rate','f-servicetext','f-servicevalue','t-tot','t-sub','t-desc','t-subline','t-signal','t-parcinfo','t-alert','preview']
  .forEach(id => field(id,''));
field('f-m2tipo','proj');
field('f-m2area','80');
field('f-m2rate','45,5');
field('f-servicetext','Limpeza do terreno');
field('f-servicevalue','0');
field('t-tot','R$ 0,00');

ctx.__setDraft(ctx.normItems(ctx.blankBudget()));
ctx.__getDraft().quoteMode = 'livre';
ctx.__getDraft().client = { name:'Teste', phone:'24999999999', address:'Petrópolis' };
ctx._dirty = false;
ctx.applyM2();
const d1 = ctx.__getDraft();
eq(d1.serviceValue, 3640, '80 m² × 45,50');
ok(String(d1.serviceText).includes('Projeto paisagístico'), 'linha de cálculo na descrição');
ok(String(d1.serviceText).startsWith('Limpeza do terreno'), 'mantém texto anterior');
eq((d1.serviceText.match(/Projeto paisagístico/g)||[]).length, 1, 'uma linha de cálculo');
eq(d1.landscaping.area, 80);
eq(d1.landscaping.rate, 45.5);

field('f-m2area','100');
field('f-m2rate','40');
ctx.applyM2();
const d2 = ctx.__getDraft();
eq(d2.serviceValue, 4000, 'reaplicar troca o valor');
eq((d2.serviceText.match(/Projeto paisagístico/g)||[]).length, 1, 'reaplicar não duplica a linha');
ok(d2.serviceText.includes('100'), 'linha atualizada com nova área');
ok(d2.serviceText.includes('Limpeza do terreno'), 'resto da descrição permanece');

field('f-name','Teste');
field('f-phone','24999999999');
field('f-addr','Petrópolis');
const today = new Date().toISOString().slice(0,10);
const valid = new Date(Date.now()+15*864e5).toISOString().slice(0,10);
field('f-date', today);
field('f-valid', valid);
field('f-status','pendente');
field('f-paymethod','Pix');
field('f-parcels','1');
field('f-signal','0');
field('f-notes','');
field('f-desc','0');
field('f-desct','pct');
field('f-desloc','0');
field('f-servicetext', ctx.__getDraft().serviceText);
field('f-servicevalue', String(ctx.__getDraft().serviceValue));

ctx.persistDraft({ goList:false });
const again = (ctx.Store.budgets||[]).find(b=>b.id===ctx.__getDraft().id);
ok(again, 'orçamento na store');
eq(again.landscaping.area, 100, 'landscaping persiste');
eq(again.landscaping.rate, 40);
eq(again.serviceValue, 4000);

const backup = ctx.Store.exportBackup();
eq(backup.format, 'maya-garden-backup', 'formato de backup da nuvem');
eq(backup.version, 1);
ok(Array.isArray(backup.data.budgets), 'backup.budgets');
const inBackup = backup.data.budgets.find(b=>b.id===again.id);
eq(inBackup.landscaping.rate, 40, 'landscaping entra no backup/sync');

storeMap.clear();
ctx.Store.importBackup(backup);
const restored = (ctx.Store.budgets||[]).find(b=>b.id===again.id);
eq(restored.landscaping.area, 100, 'restore preserva paisagismo');
eq(restored.serviceValue, 4000);

field('f-m2tipo','grama');
field('f-m2area','80');
field('f-m2rate','8');
ctx.applyM2();
eq(ctx.__getDraft().serviceValue, 640, 'corte de grama 80 m² × 8');
ok(String(ctx.__getDraft().serviceText).includes('Corte de grama'), 'linha de grama na descrição');

['p-marginPct','p-horaMin','p-horaIdeal','p-horaMax','p-m2ManutMin','p-m2ManutIdeal','p-m2ManutMax','p-m2ImplMin','p-m2ImplIdeal','p-m2ImplMax','p-projetoM2Min','p-projetoM2Ideal','p-projetoM2Max','p-vasoMin','p-vasoIdeal','p-vasoMax']
  .forEach(id => field(id, id==='p-marginPct' ? '0' : '10'));
field('p-m2ManutMin','4'); field('p-m2ManutIdeal','6'); field('p-m2ManutMax','12');
field('p-m2ImplMin','80'); field('p-m2ImplIdeal','180'); field('p-m2ImplMax','350');
field('p-projetoM2Min','20'); field('p-projetoM2Ideal','40'); field('p-projetoM2Max','60');
ctx.__toasts.length = 0;
ctx.savePricing();
eq(ctx.Store.pricing.marginPct, 0, 'savePricing aceita margem 0');
ok(!ctx.__toasts.some(t=>/maior que zero/i.test(t)), 'margem 0 não é rejeitada como preço');

field('p-m2ImplMin','200');
field('p-m2ImplIdeal','100');
field('p-m2ImplMax','350');
ctx.__toasts.length = 0;
ctx.savePricing();
ok(ctx.__toasts.some(t=>/piso e o teto/i.test(t)), 'rejeita piso > preço');

console.log('landscaping.cjs ok');
