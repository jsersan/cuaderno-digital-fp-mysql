import { inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  QueryConstraint,
  DocumentReference,
  collectionData,
  docData,
  Timestamp
} from '@core/firebase-shim';
import { Observable, from, map, of, catchError } from 'rxjs';
import { BaseEntity } from '@core/models';

export abstract class FirestoreService<T extends BaseEntity> {
  protected firestore = inject(Firestore);
  protected abstract collectionName: string;

  protected get collectionRef() {
    return collection(this.firestore, this.collectionName);
  }

  protected docRef(id: string): DocumentReference {
    return doc(this.firestore, this.collectionName, id);
  }

  // ---------- CREAR ----------

  async create(data: Partial<T>): Promise<string> {
    const docData: any = {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    // Eliminar valores undefined (Firestore no los acepta)
    Object.keys(docData).forEach(key => {
      if (docData[key] === undefined) delete docData[key];
    });
    const docRef = await addDoc(this.collectionRef, docData);
    return docRef.id;
  }

  // ---------- LEER UNO ----------

  async getById(id: string): Promise<T | null> {
    const snapshot = await getDoc(this.docRef(id));
    if (snapshot.exists()) {
      return { id: snapshot.id, ...snapshot.data() } as T;
    }
    return null;
  }

  getById$(id: string): Observable<T | undefined> {
    return docData(this.docRef(id), { idField: 'id' }) as Observable<T | undefined>;
  }

  // ---------- LEER TODOS ----------

  async getAll(): Promise<T[]> {
    const snapshot = await getDocs(this.collectionRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
  }

  getAll$(): Observable<T[]> {
    return collectionData(this.collectionRef, { idField: 'id' }) as Observable<T[]>;
  }

  // ---------- CONSULTA CON FILTROS ----------

  async queryByField(field: string, value: any): Promise<T[]> {
    try {
      const q = query(this.collectionRef, where(field, '==', value));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
    } catch (err: any) {
      console.warn(`⚠️ Firestore queryByField error en '${this.collectionName}':`, err.message);
      return [];
    }
  }

  queryByField$(field: string, value: any): Observable<T[]> {
    const q = query(this.collectionRef, where(field, '==', value));
    return (collectionData(q, { idField: 'id' }) as Observable<T[]>).pipe(
      catchError(err => {
        console.warn(`⚠️ Firestore queryByField$ error en '${this.collectionName}':`, err.message);
        return of([] as T[]);
      })
    );
  }

  async queryWithConstraints(constraints: QueryConstraint[]): Promise<T[]> {
    const q = query(this.collectionRef, ...constraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
  }

  queryWithConstraints$(constraints: QueryConstraint[]): Observable<T[]> {
    const q = query(this.collectionRef, ...constraints);
    return (collectionData(q, { idField: 'id' }) as Observable<T[]>).pipe(
      catchError(err => {
        console.warn(`⚠️ Firestore query error en '${this.collectionName}':`, err.message);
        if (err.message?.includes('index')) {
          console.warn('→ Se necesita un composite index. Despliega los indexes con: firebase deploy --only firestore:indexes');
        }
        return of([] as T[]);
      })
    );
  }

  // ---------- ACTUALIZAR ----------

  async update(id: string, data: Partial<T>): Promise<void> {
    const updateData = {
      ...data,
      updatedAt: Timestamp.now()
    };
    // Eliminar id y valores undefined (Firestore no los acepta)
    delete (updateData as any).id;
    Object.keys(updateData).forEach(key => {
      if ((updateData as any)[key] === undefined) {
        delete (updateData as any)[key];
      }
    });
    await updateDoc(this.docRef(id), updateData as any);
  }

  // ---------- ELIMINAR ----------

  async delete(id: string): Promise<void> {
    await deleteDoc(this.docRef(id));
  }

  // ---------- PAGINACIÓN ----------

  async getPaginated(
    pageSize: number,
    lastDoc?: any,
    orderField: string = 'createdAt',
    direction: 'asc' | 'desc' = 'desc'
  ): Promise<{ items: T[]; lastDoc: any }> {
    const constraints: QueryConstraint[] = [
      orderBy(orderField, direction),
      limit(pageSize)
    ];
    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }

    const q = query(this.collectionRef, ...constraints);
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
    const last = snapshot.docs[snapshot.docs.length - 1] || null;

    return { items, lastDoc: last };
  }
}
