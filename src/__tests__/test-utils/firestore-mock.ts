type DocData = { [key: string]: any };

let store: Record<string, Record<string, DocData>> = {};

export function resetMockFirestore() {
  store = {};
}

export function setCollectionDocs(collectionName: string, docs: { id?: string; data: DocData }[]) {
  store[collectionName] = {};
  docs.forEach((d, i) => {
    const id = d.id || `doc${i + 1}`;
    store[collectionName][id] = d.data;
  });
}

export function collection(_db: any, name: string) {
  return { __collection: name };
}

export function doc(...args: any[]) {
  // Supports multiple call signatures:
  // doc(db, 'collection', 'id')
  // doc(db, collectionRef, 'id')
  // doc(collectionRef)
  if (args.length === 1) {
    const collectionRef = args[0];
    if (collectionRef && collectionRef.__collection) {
      return { __collection: collectionRef.__collection, id: undefined };
    }
  }

  const [_db, collectionOrName, id] = args;
  if (collectionOrName && typeof collectionOrName === 'object' && collectionOrName.__collection) {
    return { __collection: collectionOrName.__collection, id };
  }

  return { __collection: collectionOrName, id };
}

export function where(field: string, op: string, value: any) {
  return { __where: { field, op, value } };
}

export function query(collectionRef: any, ...constraints: any[]) {
  return { __query: true, collection: collectionRef.__collection || collectionRef, constraints };
}

export async function getDocs(refOrQuery: any) {
  let collectionName = '';
  let constraints: any[] = [];

  if (refOrQuery && refOrQuery.__query) {
    collectionName = refOrQuery.collection;
    constraints = refOrQuery.constraints || [];
  } else if (refOrQuery && refOrQuery.__collection) {
    collectionName = refOrQuery.__collection;
  } else if (typeof refOrQuery === 'string') {
    collectionName = refOrQuery;
  }

  const col = store[collectionName] || {};
  const docsAll = Object.keys(col).map(id => ({ id, data: () => col[id], ref: { __collection: collectionName, id } }));

  if (constraints && constraints.length) {
    let filtered = docsAll.slice();
    for (const c of constraints) {
      if (!c) continue;
      if (c.__where) {
        const { field, op, value } = c.__where;
        filtered = filtered.filter(d => {
          const dv = (d.data() || {})[field];
          if (op === '==') return dv === value;
          if (op === '>=') {
            if (dv === undefined || dv === null) return false;
            // Handle Timestamp objects
            const left = (dv instanceof Date) ? dv.getTime() : 
                         (dv && dv.toDate && typeof dv.toDate === 'function') ? dv.toDate().getTime() :
                         Number(dv);
            const right = (value instanceof Date) ? value.getTime() : Number(value);
            return left >= right;
          }
          if (op === '<') {
            if (dv === undefined || dv === null) return false;
            // Handle Timestamp objects
            const left = (dv instanceof Date) ? dv.getTime() : 
                         (dv && dv.toDate && typeof dv.toDate === 'function') ? dv.toDate().getTime() :
                         Number(dv);
            const right = (value instanceof Date) ? value.getTime() : Number(value);
            return left < right;
          }
          return false;
        });
      }
      if (c.__limit) {
        filtered = filtered.slice(0, c.__limit);
      }
      // ignore orderBy for now (it affects ordering only)
    }
    return { docs: filtered, size: filtered.length, empty: filtered.length === 0 };
  }

  return { docs: docsAll, size: docsAll.length, empty: docsAll.length === 0 };
}

export async function getDoc(docRef: any) {
  const collectionName = docRef.__collection;
  const id = docRef.id;
  const col = store[collectionName] || {};
  if (!id) return { exists: () => false } as any;
  const data = col[id];
  if (!data) return { exists: () => false } as any;
  return { exists: () => true, data: () => data } as any;
}

export function setDoc(docRef: any, data: DocData, _opts?: any) {
  const collectionName = docRef.__collection || docRef.collection;
  const id = docRef.id || `doc${Object.keys(store[collectionName] || {}).length + 1}`;
  store[collectionName] = store[collectionName] || {};
  store[collectionName][id] = data;
  return Promise.resolve();
}

export function updateDoc(docRef: any, updates: DocData) {
  const collectionName = docRef.__collection || docRef.collection;
  const id = docRef.id;
  store[collectionName] = store[collectionName] || {};
  const current = store[collectionName][id] || {};
  // handle increment operation
  const newData = { ...current };
  for (const k of Object.keys(updates)) {
    const v = updates[k];
    if (v && v.__op === 'increment') {
      newData[k] = (newData[k] || 0) + v.amount;
    } else {
      newData[k] = v;
    }
  }
  store[collectionName][id] = newData;
  return Promise.resolve();
}

export function writeBatch(_db: any) {
  const ops: Array<() => Promise<void>> = [];
  return {
    set(docRef: any, data: any, _opts?: any) { ops.push(() => setDoc(docRef, data, _opts)); },
    update(docRef: any, updates: any) { ops.push(() => updateDoc(docRef, updates)); },
    delete(docRef: any) { ops.push(async () => { const col = docRef.__collection; const id = docRef.id; if (store[col]) delete store[col][id]; }); },
    commit: async () => { for (const fn of ops) await fn(); }
  };
}

export function increment(amount: number) {
  return { __op: 'increment', amount };
}

// Mock Timestamp class for testing
export class Timestamp {
  constructor(public date: Date) {}
  
  static fromDate(date: Date): Timestamp {
    return new Timestamp(date);
  }
  
  toDate(): Date {
    return this.date;
  }
}

export function serverTimestamp() {
  return Date.now();
}

export async function runTransaction(_db: any, updateFn: any) {
  const tx = {
    get: async (ref: any) => await getDoc(ref),
    set: (ref: any, data: any, opts?: any) => { setDoc(ref, data, opts); },
    update: (ref: any, updates: any) => { updateDoc(ref, updates); },
  };
  return updateFn(tx);
}

export async function addDoc(collectionRef: any, data: any) {
  const collectionName = collectionRef.__collection || collectionRef;
  const id = `doc${(Object.keys(store[collectionName] || {}).length + 1)}`;
  store[collectionName] = store[collectionName] || {};
  store[collectionName][id] = data;
  return { id };
}

export async function deleteDoc(docRef: any) {
  const col = docRef.__collection;
  const id = docRef.id;
  if (store[col]) delete store[col][id];
  return Promise.resolve();
}

export const limit = (n: number) => ({ __limit: n });

export function orderBy(field: string, dir?: 'asc' | 'desc') {
  return { __orderBy: { field, dir: dir || 'asc' } };
}

// exports required so vitest's mock factory can return this module
export default {
  resetMockFirestore,
  setCollectionDocs,
  collection,
  doc,
  where,
  query,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  writeBatch,
  increment,
  serverTimestamp,
  runTransaction,
  addDoc,
  deleteDoc,
  limit,
  documentId: () => '__name__',
  Timestamp,
};
