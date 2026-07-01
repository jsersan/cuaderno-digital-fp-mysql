// ============================================================================
//  firebase-shim.ts
//  Reemplazo de '@angular/fire/firestore' que habla con la API REST (MySQL)
//  en lugar de con Firestore. Mantiene la MISMA API pública (mismas funciones
//  y firmas) para que los servicios y componentes existentes sigan compilando
//  y funcionando con sólo cambiar la ruta del import.
//
//  Diferencia de comportamiento: los métodos "en tiempo real" (collectionData /
//  docData) hacen una única lectura HTTP y emiten una vez (no hay streaming en
//  vivo como en Firestore). Para un cuaderno CRUD es suficiente.
// ============================================================================

import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '@env/environment';

export const TOKEN_KEY = 'cuaderno_token';

/**
 * Construye la URL final. Si la base apunta a index.php (caso MAMP sin
 * mod_rewrite ni PATH_INFO), usa ?path=... que siempre funciona. Si no,
 * usa rutas "bonitas" /coleccion/id.
 */
export function buildUrl(baseUrl: string, path: string): string {
  if (baseUrl.includes('index.php')) {
    return `${baseUrl}?path=${encodeURIComponent(path)}`;
  }
  return `${baseUrl}/${path}`;
}

// ---------------------------------------------------------------------------
//  Timestamp  (compatible con firebase.Timestamp: seconds / nanoseconds)
// ---------------------------------------------------------------------------
export class Timestamp {
  constructor(public seconds: number, public nanoseconds: number) {}

  static now(): Timestamp {
    const ms = Date.now();
    return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6);
  }
  static fromDate(date: Date): Timestamp {
    const ms = date.getTime();
    return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6);
  }
  static fromMillis(ms: number): Timestamp {
    return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6);
  }
  toDate(): Date {
    return new Date(this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6));
  }
  toMillis(): number {
    return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6);
  }
  toJSON() {
    return { seconds: this.seconds, nanoseconds: this.nanoseconds };
  }
}

/** Revive recursivamente {seconds,nanoseconds} -> instancias Timestamp. */
function reviveTimestamps(value: any): any {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Timestamp) return value;
  if (Array.isArray(value)) return value.map(reviveTimestamps);
  if (
    typeof value.seconds === 'number' &&
    typeof value.nanoseconds === 'number' &&
    Object.keys(value).length <= 3
  ) {
    return new Timestamp(value.seconds, value.nanoseconds);
  }
  const out: any = {};
  for (const k of Object.keys(value)) out[k] = reviveTimestamps(value[k]);
  return out;
}

// ---------------------------------------------------------------------------
//  Restricciones de consulta (where / orderBy / limit / startAfter)
// ---------------------------------------------------------------------------
export type WhereOp = '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'array-contains';
export interface QueryConstraint {
  __c: 'where' | 'orderBy' | 'limit' | 'startAfter';
  field?: string;
  op?: WhereOp;
  value?: any;
  dir?: 'asc' | 'desc';
  n?: number;
}

export function where(field: string, op: WhereOp, value: any): QueryConstraint {
  return { __c: 'where', field, op, value };
}
export function orderBy(field: string, dir: 'asc' | 'desc' = 'asc'): QueryConstraint {
  return { __c: 'orderBy', field, dir };
}
export function limit(n: number): QueryConstraint {
  return { __c: 'limit', n };
}
// La paginación por cursor no se soporta vía REST: se ignora (devuelve 1ª página).
export function startAfter(_lastDoc?: any): QueryConstraint {
  return { __c: 'startAfter' };
}

// ---------------------------------------------------------------------------
//  Referencias (collection / doc / query)
// ---------------------------------------------------------------------------
export interface CollectionRef {
  __type: 'collection';
  db: Firestore;
  segments: string[];
}
export interface DocumentReference {
  __type: 'doc';
  db: Firestore;
  segments: string[];
}
export interface QueryRef {
  __type: 'query';
  db: Firestore;
  segments: string[];
  constraints: QueryConstraint[];
}

/** Divide segmentos que puedan venir como 'a/b/c'. */
function splitSegments(parts: string[]): string[] {
  return parts.flatMap(p => String(p).split('/')).filter(s => s.length > 0);
}

export function collection(db: Firestore, ...path: string[]): CollectionRef {
  return { __type: 'collection', db, segments: splitSegments(path) };
}
export function doc(db: Firestore, ...path: string[]): DocumentReference {
  return { __type: 'doc', db, segments: splitSegments(path) };
}
export function query(ref: CollectionRef, ...constraints: QueryConstraint[]): QueryRef {
  return { __type: 'query', db: ref.db, segments: ref.segments, constraints };
}

// ---------------------------------------------------------------------------
//  Snapshots (compatibles con la API de Firestore)
// ---------------------------------------------------------------------------
export interface DocumentSnapshot {
  id: string;
  ref: DocumentReference;
  exists(): boolean;
  data(): any;
}
export interface QuerySnapshot {
  docs: DocumentSnapshot[];
  empty: boolean;
  size: number;
  forEach(cb: (d: DocumentSnapshot) => void): void;
}

function makeDocSnap(obj: any | null, id: string, ref: DocumentReference): DocumentSnapshot {
  const exists = obj !== null && obj !== undefined;
  const data = exists ? { ...obj } : null;
  if (data) delete data.id;
  return { id, ref, exists: () => exists, data: () => data };
}
function makeQuerySnap(items: any[], db: Firestore, colSegments: string[]): QuerySnapshot {
  const docs = items.map(it =>
    makeDocSnap(it, it.id, { __type: 'doc', db, segments: [...colSegments, it.id] })
  );
  return { docs, empty: docs.length === 0, size: docs.length, forEach: cb => docs.forEach(cb) };
}

// ---------------------------------------------------------------------------
//  Cliente Firestore (inyectable). Sustituye a @angular/fire Firestore.
// ---------------------------------------------------------------------------
@Injectable({ providedIn: 'root' })
export class Firestore {
  readonly baseUrl = (environment as any).apiUrl?.replace(/\/$/, '') || '';

  async request(method: string, path: string, body?: any): Promise<any> {
    const token = (typeof localStorage !== 'undefined') ? localStorage.getItem(TOKEN_KEY) : null;
    const res = await fetch(buildUrl(this.baseUrl, path), {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try { const j = await res.json(); if (j?.error) msg = j.error; } catch {}
      throw new Error(msg);
    }
    if (res.status === 204) return null;
    const json = await res.json().catch(() => null);
    return reviveTimestamps(json);
  }
}

// Rutas a partir de los segmentos -------------------------------------------
function collectionPath(segments: string[]): string {
  return segments.join('/');
}
function docCollectionPath(segments: string[]): string {
  return segments.slice(0, -1).join('/');
}
function docId(segments: string[]): string {
  return segments[segments.length - 1];
}

// ---------------------------------------------------------------------------
//  Operaciones imperativas
// ---------------------------------------------------------------------------
export async function getDoc(ref: DocumentReference): Promise<DocumentSnapshot> {
  const path = `${docCollectionPath(ref.segments)}/${docId(ref.segments)}`;
  const obj = await ref.db.request('GET', path);
  return makeDocSnap(obj, docId(ref.segments), ref);
}

export async function getDocs(ref: CollectionRef | QueryRef): Promise<QuerySnapshot> {
  if (ref.__type === 'query') {
    const filters: any[] = [];
    const order: any[] = [];
    let lim: number | null = null;
    for (const c of ref.constraints) {
      if (c.__c === 'where') filters.push({ field: c.field, op: c.op, value: c.value });
      else if (c.__c === 'orderBy') order.push({ field: c.field, dir: c.dir });
      else if (c.__c === 'limit') lim = c.n ?? null;
    }
    const col = ref.segments.join('/');
    const items = await ref.db.request('POST', `${col}:query`, { filters, orderBy: order, limit: lim });
    return makeQuerySnap(items || [], ref.db, ref.segments);
  }
  const items = await ref.db.request('GET', collectionPath(ref.segments));
  return makeQuerySnap(items || [], ref.db, ref.segments);
}

export async function addDoc(ref: CollectionRef, data: any): Promise<{ id: string }> {
  const res = await ref.db.request('POST', collectionPath(ref.segments), data);
  return { id: res?.id };
}

export async function setDoc(ref: DocumentReference, data: any, options?: { merge?: boolean }): Promise<void> {
  const path = `${docCollectionPath(ref.segments)}/${docId(ref.segments)}`;
  // merge:true => fusiona campos (PATCH); si no, reemplaza el documento (PUT).
  await ref.db.request(options?.merge ? 'PATCH' : 'PUT', path, data);
}

export async function updateDoc(ref: DocumentReference, data: any): Promise<void> {
  const path = `${docCollectionPath(ref.segments)}/${docId(ref.segments)}`;
  await ref.db.request('PATCH', path, data);
}

export async function deleteDoc(ref: DocumentReference): Promise<void> {
  const path = `${docCollectionPath(ref.segments)}/${docId(ref.segments)}`;
  await ref.db.request('DELETE', path);
}

// ---------------------------------------------------------------------------
//  Lecturas como Observable (collectionData / docData) — una sola emisión
// ---------------------------------------------------------------------------
export function collectionData(ref: CollectionRef | QueryRef, opts?: { idField?: string }): Observable<any[]> {
  const idField = opts?.idField || 'id';
  return from(getDocs(ref)).pipe(
    map(snap => snap.docs.map(d => {
      const o = d.data() || {};
      o[idField] = d.id;
      return o;
    }))
  );
}

export function docData(ref: DocumentReference, opts?: { idField?: string }): Observable<any> {
  const idField = opts?.idField || 'id';
  return from(getDoc(ref)).pipe(
    map(snap => {
      if (!snap.exists()) return undefined;
      const o = snap.data() || {};
      o[idField] = snap.id;
      return o;
    })
  );
}

// ---------------------------------------------------------------------------
//  writeBatch — acumula operaciones y las ejecuta en commit()
// ---------------------------------------------------------------------------
export function writeBatch(db: Firestore) {
  const ops: Array<{ m: string; ref: DocumentReference; data?: any }> = [];
  return {
    set(ref: DocumentReference, data: any) { ops.push({ m: 'PUT', ref, data }); return this; },
    update(ref: DocumentReference, data: any) { ops.push({ m: 'PATCH', ref, data }); return this; },
    delete(ref: DocumentReference) { ops.push({ m: 'DELETE', ref }); return this; },
    async commit() {
      for (const op of ops) {
        const path = `${docCollectionPath(op.ref.segments)}/${docId(op.ref.segments)}`;
        await db.request(op.m, path, op.data);
      }
    }
  };
}
